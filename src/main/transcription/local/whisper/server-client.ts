import { spawn, type ChildProcessByStdio } from 'node:child_process'
import { cpus } from 'node:os'
import type { Readable } from 'node:stream'
import { createSettleOnce } from '../../../helpers/settle-once'
import type { WhisperModelId } from './model-catalog'
import { findRuntimePort, resolveRuntimeBinaryPath } from './runtime-discovery'
import { getWhisperModelFilePath } from '../model-dir-utils'

const STARTUP_TIMEOUT_SECONDS = 30
const STARTUP_TIMEOUT_MS = STARTUP_TIMEOUT_SECONDS * 1000
const STARTUP_PORT_RETRY_MAX_ATTEMPTS = 4
const HEALTHCHECK_POLL_INTERVAL_MS = 250
const TRANSCRIPTION_TIMEOUT_SECONDS = 300
const TRANSCRIPTION_TIMEOUT_MS = TRANSCRIPTION_TIMEOUT_SECONDS * 1000
const DEFAULT_IDLE_STOP_MS = 2 * 60 * 1000
const DEFAULT_THREADS = Math.max(2, Math.min(4, Math.floor(cpus().length * 0.5) || 2))

const isAddressInUseError = (message: string): boolean =>
  /address already in use|eaddrinuse/i.test(message)

const isMissingWhisperDylibError = (details: string): boolean =>
  /Library not loaded:\s*@rpath\/libwhisper\.1\.dylib/i.test(details)

export type WhisperRuntimeStatus = {
  available: boolean
  running: boolean
  modelId: WhisperModelId | null
  binaryPath: string | null
}

export class WhisperServerClient {
  private process: ChildProcessByStdio<null, Readable, Readable> | null = null
  private port: number | null = null
  private modelId: WhisperModelId | null = null
  private binaryPath: string | null = null
  private idleStopTimer: NodeJS.Timeout | null = null

  private isRunning(): boolean {
    return Boolean(this.process && this.port !== null)
  }

  isAvailable(): boolean {
    this.binaryPath = resolveRuntimeBinaryPath()
    return this.binaryPath !== null
  }

  getStatus(): WhisperRuntimeStatus {
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

  private clearIdleStopTimer(): void {
    if (!this.idleStopTimer) {
      return
    }

    clearTimeout(this.idleStopTimer)
    this.idleStopTimer = null
  }

  private scheduleIdleStop(): void {
    this.clearIdleStopTimer()
    this.idleStopTimer = setTimeout(() => {
      void this.stop().catch((error) => {
        console.error('[transcription] failed to stop idle Whisper runtime', error)
      })
    }, DEFAULT_IDLE_STOP_MS)
    this.idleStopTimer.unref()
  }

  private async checkHealth(): Promise<boolean> {
    if (!this.port) {
      return false
    }

    try {
      const response = await fetch(`http://127.0.0.1:${this.port}/`, {
        method: 'GET'
      })
      return response.ok
    } catch {
      return false
    }
  }

  private async waitUntilReady(
    processRef: ChildProcessByStdio<null, Readable, Readable>
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let stderrOutput = ''
      let stdoutOutput = ''
      const settleController = createSettleOnce<Error | null>((error) => {
        clearInterval(pollRef)
        clearTimeout(timeoutRef)

        if (error) {
          reject(error)
          return
        }

        resolve()
      })

      const pollRef = setInterval(async () => {
        if (settleController.isSettled()) {
          return
        }

        const healthy = await this.checkHealth()
        if (healthy) {
          settleController.settle(null)
        }
      }, HEALTHCHECK_POLL_INTERVAL_MS)

      const timeoutRef = setTimeout(() => {
        const details = [stderrOutput, stdoutOutput].join('\n').trim().slice(-1000)
        settleController.settle(
          new Error(
            details.length > 0
              ? `Local Whisper runtime start timed out. ${details}`
              : 'Local Whisper runtime start timed out.'
          )
        )
      }, STARTUP_TIMEOUT_MS)

      processRef.stderr.on('data', (chunk) => {
        stderrOutput += String(chunk)
      })

      processRef.stdout.on('data', (chunk) => {
        stdoutOutput += String(chunk)
      })

      processRef.on('error', (error) => {
        settleController.settle(
          new Error(`Failed to start local Whisper runtime: ${error.message}`)
        )
      })

      processRef.on('close', (code, signal) => {
        const details = [stderrOutput, stdoutOutput].join('\n').trim().slice(-1000)
        const exit = signal ? `signal ${signal}` : `code ${code}`

        if (isMissingWhisperDylibError(details)) {
          settleController.settle(
            new Error(
              'Whisper runtime binary is incomplete (missing libwhisper.1.dylib). Rebuild with "npm run build:whisper-cpp-runtime -- --force" and restart app.'
            )
          )
          return
        }

        settleController.settle(
          new Error(
            details.length > 0
              ? `Local Whisper runtime exited during startup (${exit}). ${details}`
              : `Local Whisper runtime exited during startup (${exit}).`
          )
        )
      })
    })
  }

  async start(modelId: WhisperModelId): Promise<void> {
    this.clearIdleStopTimer()

    if (this.modelId === modelId && this.isRunning()) {
      return
    }

    await this.stop()

    this.binaryPath = resolveRuntimeBinaryPath()
    if (!this.binaryPath) {
      throw new Error('Local Whisper runtime binary is unavailable on this platform.')
    }

    const modelPath = getWhisperModelFilePath(modelId)
    const triedPorts = new Set<number>()

    for (let attempt = 1; attempt <= STARTUP_PORT_RETRY_MAX_ATTEMPTS; attempt += 1) {
      this.port = await findRuntimePort({ exclude: triedPorts })
      const selectedPort = this.port
      triedPorts.add(selectedPort)

      const args = [
        '--model',
        modelPath,
        '--host',
        '127.0.0.1',
        '--port',
        String(this.port),
        '--language',
        'auto',
        '--threads',
        String(DEFAULT_THREADS)
      ]

      const processRef = spawn(this.binaryPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
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
        return
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to start local Whisper runtime.'
        const retryableBindError = isAddressInUseError(message)
        const canRetry = retryableBindError && attempt < STARTUP_PORT_RETRY_MAX_ATTEMPTS

        await this.stop()

        if (canRetry) {
          console.warn(
            '[transcription] local Whisper runtime bind conflict, retrying on another port',
            {
              attempt,
              port: selectedPort
            }
          )
          continue
        }

        throw error
      }
    }
  }

  async stop(): Promise<void> {
    this.clearIdleStopTimer()

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

  async transcribe(wavBuffer: Buffer): Promise<string> {
    if (!this.isRunning() || this.port === null) {
      throw new Error('Local Whisper runtime is not running.')
    }

    this.clearIdleStopTimer()

    const formData = new FormData()
    const wavBytes = Uint8Array.from(wavBuffer)
    formData.append('file', new Blob([wavBytes], { type: 'audio/wav' }), 'audio.wav')
    formData.append('response_format', 'json')
    formData.append('language', 'auto')

    const abortController = new AbortController()
    const timeout = setTimeout(() => {
      abortController.abort('timeout')
    }, TRANSCRIPTION_TIMEOUT_MS)

    try {
      const response = await fetch(`http://127.0.0.1:${this.port}/inference`, {
        method: 'POST',
        body: formData,
        signal: abortController.signal
      })

      if (!response.ok) {
        const responseBody = await response.text().catch(() => '')
        throw new Error(
          `Local Whisper runtime request failed with status ${response.status}. ${responseBody.slice(0, 240)}`
        )
      }

      const payload = (await response.json()) as { text?: unknown }
      const text = typeof payload.text === 'string' ? payload.text.trim() : ''
      return text
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error('Local Whisper transcription timed out.')
      }

      const message = error instanceof Error ? error.message : 'Unknown runtime request failure.'
      throw new Error(`Local Whisper runtime request failed: ${message}`)
    } finally {
      clearTimeout(timeout)
      this.scheduleIdleStop()
    }
  }
}
