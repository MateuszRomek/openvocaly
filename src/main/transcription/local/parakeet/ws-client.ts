import { spawn, type ChildProcessByStdio } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Readable } from 'node:stream'
import WebSocket from 'ws'
import { createSettleOnce } from '../../../helpers/settle-once'
import { createLogger } from '../../../helpers/logger'
import { getParakeetModelDir, getParakeetModelsRootDir } from '../model-dir-utils'
import { findRuntimePort, resolveRuntimeBinaryPath } from './runtime-discovery'
import type { ParakeetModelId } from './model-catalog'

const STARTUP_TIMEOUT_SECONDS = 60
const STARTUP_TIMEOUT_MS = STARTUP_TIMEOUT_SECONDS * 1000
const STARTUP_PORT_RETRY_MAX_ATTEMPTS = 4
const TRANSCRIPTION_TIMEOUT_SECONDS = 300
const TRANSCRIPTION_TIMEOUT_MS = TRANSCRIPTION_TIMEOUT_SECONDS * 1000
const DISABLED_LOG_FILE_PATH = process.platform === 'win32' ? 'NUL' : '/dev/null'

const isAddressInUseError = (message: string): boolean =>
  /address already in use|eaddrinuse|asio\.system:48/i.test(message)

export type ParakeetRuntimeStatus = {
  available: boolean
  running: boolean
  modelId: ParakeetModelId | null
  binaryPath: string | null
}

export class ParakeetWsClient {
  private readonly logger = createLogger('transcription.local.parakeet.ws-client')
  private process: ChildProcessByStdio<null, Readable, Readable> | null = null
  private port: number | null = null
  private modelId: ParakeetModelId | null = null
  private binaryPath: string | null = null

  private isRunning(): boolean {
    return Boolean(this.process && this.port !== null)
  }

  isAvailable(): boolean {
    this.binaryPath = resolveRuntimeBinaryPath()
    return this.binaryPath !== null
  }

  getStatus(): ParakeetRuntimeStatus {
    if (!this.binaryPath) {
      this.binaryPath = resolveRuntimeBinaryPath()
    }

    return {
      available: this.binaryPath !== null,
      running: this.isRunning(),
      modelId: this.modelId,
      binaryPath: this.binaryPath
    }
  }

  private async waitUntilReady(
    processRef: ChildProcessByStdio<null, Readable, Readable>
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let stderrOutput = ''
      let stdoutOutput = ''
      const settleController = createSettleOnce<Error | null>((error) => {
        clearTimeout(timeout)

        if (error) {
          reject(error)
          return
        }

        resolve()
      })

      const timeout = setTimeout(() => {
        const details = [stderrOutput, stdoutOutput].join('\n').trim().slice(-1000)
        settleController.settle(
          new Error(
            details.length > 0
              ? `Local Parakeet runtime start timed out. ${details}`
              : 'Local Parakeet runtime start timed out.'
          )
        )
      }, STARTUP_TIMEOUT_MS)

      const handleOutputChunk = (chunk: unknown): void => {
        const text = String(chunk)
        if (!settleController.isSettled() && /listening on/i.test(text)) {
          settleController.settle(null)
        }
      }

      processRef.stderr.on('data', (chunk) => {
        const text = String(chunk)
        stderrOutput += text
        handleOutputChunk(chunk)
      })

      processRef.stdout.on('data', (chunk) => {
        stdoutOutput += String(chunk)
        handleOutputChunk(chunk)
      })

      processRef.on('error', (error) => {
        settleController.settle(
          new Error(`Failed to start local Parakeet runtime: ${error.message}`)
        )
      })

      processRef.on('close', (code, signal) => {
        const details = [stderrOutput, stdoutOutput].join('\n').trim().slice(-1000)
        const exit = signal ? `signal ${signal}` : `code ${code}`
        settleController.settle(
          new Error(
            details.length > 0
              ? `Local Parakeet runtime exited during startup (${exit}). ${details}`
              : `Local Parakeet runtime exited during startup (${exit}).`
          )
        )
      })
    })
  }

  async start(modelId: ParakeetModelId): Promise<void> {
    if (this.modelId === modelId && this.isRunning()) {
      return
    }

    this.logger.debug({
      event: 'runtime_start_requested',
      modelId
    })

    await this.stop()

    this.binaryPath = resolveRuntimeBinaryPath()
    if (!this.binaryPath) {
      throw new Error('Local Parakeet runtime binary is unavailable on this platform.')
    }

    const modelDir = getParakeetModelDir(modelId)
    await mkdir(getParakeetModelsRootDir(), { recursive: true })
    const runtimeDir = dirname(this.binaryPath)
    const triedPorts = new Set<number>()

    for (let attempt = 1; attempt <= STARTUP_PORT_RETRY_MAX_ATTEMPTS; attempt += 1) {
      this.port = await findRuntimePort({ exclude: triedPorts })
      const selectedPort = this.port
      triedPorts.add(selectedPort)

      const args = [
        `--tokens=${join(modelDir, 'tokens.txt')}`,
        `--encoder=${join(modelDir, 'encoder.int8.onnx')}`,
        `--decoder=${join(modelDir, 'decoder.int8.onnx')}`,
        `--joiner=${join(modelDir, 'joiner.int8.onnx')}`,
        `--port=${this.port}`,
        `--log-file=${DISABLED_LOG_FILE_PATH}`,
        '--num-threads=4'
      ]

      const processRef = spawn(this.binaryPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env: {
          ...process.env,
          DYLD_LIBRARY_PATH: [runtimeDir, process.env['DYLD_LIBRARY_PATH']]
            .filter(Boolean)
            .join(':'),
          LD_LIBRARY_PATH: [runtimeDir, process.env['LD_LIBRARY_PATH']].filter(Boolean).join(':')
        }
      })
      this.process = processRef
      this.modelId = modelId

      processRef.on('close', () => {
        this.process = null
        this.port = null
        this.modelId = null
      })

      try {
        await this.waitUntilReady(processRef)
        this.logger.debug({
          event: 'runtime_started',
          modelId,
          port: selectedPort
        })
        return
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to start local Parakeet runtime.'
        const retryableBindError = isAddressInUseError(message)
        const canRetry = retryableBindError && attempt < STARTUP_PORT_RETRY_MAX_ATTEMPTS

        await this.stop()

        if (canRetry) {
          this.logger.warn({
            event: 'runtime_bind_retry',
            attempt,
            port: selectedPort
          })
          continue
        }

        this.logger.error({
          event: 'runtime_start_failed',
          modelId,
          message
        })
        throw error
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.process) {
      this.port = null
      this.modelId = null
      return
    }

    const processRef = this.process
    this.process = null
    const currentModelId = this.modelId
    const currentPort = this.port

    this.logger.debug({
      event: 'runtime_stop_requested',
      modelId: currentModelId,
      port: currentPort
    })

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        try {
          processRef.kill('SIGKILL')
        } catch {
          // Ignore force kill errors.
        }
        resolve()
      }, 5000)

      processRef.once('close', () => {
        clearTimeout(timeout)
        resolve()
      })

      try {
        processRef.kill('SIGTERM')
      } catch {
        clearTimeout(timeout)
        resolve()
      }
    })

    this.port = null
    this.modelId = null

    this.logger.debug({
      event: 'runtime_stopped',
      modelId: currentModelId,
      port: currentPort
    })
  }

  async transcribe(float32Samples: Buffer, sampleRate: number): Promise<string> {
    if (!this.isRunning() || this.port === null) {
      throw new Error('Local Parakeet runtime is not running.')
    }

    return await new Promise<string>((resolve, reject) => {
      // Batch mode keeps one short-lived websocket per transcription request.
      const ws = new WebSocket(`ws://127.0.0.1:${this.port}`)
      let result = ''
      let doneSent = false
      const startedAt = Date.now()

      const sendDone = (): void => {
        if (doneSent || ws.readyState !== WebSocket.OPEN) {
          return
        }

        doneSent = true
        ws.send('Done')
      }

      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error('Local Parakeet transcription timed out.'))
      }, TRANSCRIPTION_TIMEOUT_MS)

      ws.on('open', () => {
        const message = Buffer.alloc(8 + float32Samples.length)
        message.writeInt32LE(sampleRate, 0)
        message.writeInt32LE(float32Samples.length, 4)
        float32Samples.copy(message, 8)
        ws.send(message)
      })

      ws.on('message', (chunk) => {
        result += String(chunk)
        sendDone()
      })

      ws.on('close', () => {
        clearTimeout(timeout)
        const elapsedMs = Date.now() - startedAt
        try {
          const parsed = JSON.parse(result) as { text?: string }
          const text = (parsed.text ?? '').trim()
          this.logger.debug({
            event: 'runtime_transcribe_complete',
            elapsedMs,
            sampleRate,
            sampleBytes: float32Samples.length,
            resultLength: text.length
          })
          resolve(text)
        } catch {
          const text = result.trim()
          this.logger.debug({
            event: 'runtime_transcribe_complete',
            elapsedMs,
            sampleRate,
            sampleBytes: float32Samples.length,
            resultLength: text.length
          })
          resolve(text)
        }
      })

      ws.on('error', (error) => {
        clearTimeout(timeout)
        this.logger.warn({
          event: 'runtime_transcribe_error',
          sampleRate,
          sampleBytes: float32Samples.length,
          message: error.message
        })
        reject(new Error(`Local Parakeet runtime request failed: ${error.message}`))
      })
    })
  }
}
