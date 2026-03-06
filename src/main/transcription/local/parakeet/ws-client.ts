import { spawn, type ChildProcessByStdio } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Readable } from 'node:stream'
import WebSocket from 'ws'
import { getParakeetModelDir, getParakeetModelsRootDir } from '../model-dir-utils'
import type { LocalTranscriptionModelId } from '../../../../shared/local-transcription'
import { findRuntimePort, resolveRuntimeBinaryPath } from './runtime-discovery'

const STARTUP_TIMEOUT_SECONDS = 60
const STARTUP_TIMEOUT_MS = STARTUP_TIMEOUT_SECONDS * 1000
const TRANSCRIPTION_TIMEOUT_SECONDS = 300
const TRANSCRIPTION_TIMEOUT_MS = TRANSCRIPTION_TIMEOUT_SECONDS * 1000
const DISABLED_LOG_FILE_PATH = process.platform === 'win32' ? 'NUL' : '/dev/null'

export type ParakeetRuntimeStatus = {
  available: boolean
  running: boolean
  modelId: LocalTranscriptionModelId | null
  binaryPath: string | null
}

export class ParakeetWsClient {
  private process: ChildProcessByStdio<null, Readable, Readable> | null = null
  private port: number | null = null
  private modelId: LocalTranscriptionModelId | null = null
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
      let settled = false
      let stderrOutput = ''
      let stdoutOutput = ''
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true
          const details = [stderrOutput, stdoutOutput].join('\n').trim().slice(-1000)
          reject(
            new Error(
              details.length > 0
                ? `Local Parakeet runtime start timed out. ${details}`
                : 'Local Parakeet runtime start timed out.'
            )
          )
        }
      }, STARTUP_TIMEOUT_MS)

      const handleOutputChunk = (chunk: unknown): void => {
        const text = String(chunk)
        if (!settled && /listening on/i.test(text)) {
          settled = true
          clearTimeout(timeout)
          resolve()
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
        if (!settled) {
          settled = true
          clearTimeout(timeout)
          reject(new Error(`Failed to start local Parakeet runtime: ${error.message}`))
        }
      })

      processRef.on('close', (code, signal) => {
        if (!settled) {
          settled = true
          clearTimeout(timeout)
          const details = [stderrOutput, stdoutOutput].join('\n').trim().slice(-1000)
          const exit = signal ? `signal ${signal}` : `code ${code}`
          reject(
            new Error(
              details.length > 0
                ? `Local Parakeet runtime exited during startup (${exit}). ${details}`
                : `Local Parakeet runtime exited during startup (${exit}).`
            )
          )
        }
      })
    })
  }

  async start(modelId: LocalTranscriptionModelId): Promise<void> {
    if (this.modelId === modelId && this.isRunning()) {
      return
    }

    await this.stop()

    this.binaryPath = resolveRuntimeBinaryPath()
    if (!this.binaryPath) {
      throw new Error('Local Parakeet runtime binary is unavailable on this platform.')
    }

    const modelDir = getParakeetModelDir(modelId)
    await mkdir(getParakeetModelsRootDir(), { recursive: true })
    this.port = await findRuntimePort()

    const args = [
      `--tokens=${join(modelDir, 'tokens.txt')}`,
      `--encoder=${join(modelDir, 'encoder.int8.onnx')}`,
      `--decoder=${join(modelDir, 'decoder.int8.onnx')}`,
      `--joiner=${join(modelDir, 'joiner.int8.onnx')}`,
      `--port=${this.port}`,
      `--log-file=${DISABLED_LOG_FILE_PATH}`,
      '--num-threads=4'
    ]
    const runtimeDir = dirname(this.binaryPath)

    const processRef = spawn(this.binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        DYLD_LIBRARY_PATH: [runtimeDir, process.env['DYLD_LIBRARY_PATH']].filter(Boolean).join(':'),
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

    await this.waitUntilReady(processRef)
  }

  async stop(): Promise<void> {
    if (!this.process) {
      this.port = null
      this.modelId = null
      return
    }

    const processRef = this.process
    this.process = null

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
  }

  async transcribe(float32Samples: Buffer, sampleRate: number): Promise<string> {
    if (!this.isRunning() || this.port === null) {
      throw new Error('Local Parakeet runtime is not running.')
    }

    return await new Promise<string>((resolve, reject) => {
      // Batch mode keeps one short-lived websocket per transcription request.
      const ws = new WebSocket(`ws://127.0.0.1:${this.port}`)
      let result = ''

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
        ws.send('Done')
      })

      ws.on('close', () => {
        clearTimeout(timeout)
        try {
          const parsed = JSON.parse(result) as { text?: string }
          resolve((parsed.text ?? '').trim())
        } catch {
          resolve(result.trim())
        }
      })

      ws.on('error', (error) => {
        clearTimeout(timeout)
        reject(new Error(`Local Parakeet runtime request failed: ${error.message}`))
      })
    })
  }
}
