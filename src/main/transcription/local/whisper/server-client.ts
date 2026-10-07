import { execFile, spawn, type ChildProcessByStdio } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { Readable } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'
import { createSettleOnce } from '../../../helpers/settle-once'
import type { WhisperModelId } from './model-catalog'
import { findRuntimePort, resolveRuntimeBinaryPath } from './runtime-discovery'
import { getWhisperModelFilePath, getWhisperModelsRootDir } from '../model-dir-utils'
import { buildWhisperServerArgs } from './server-options'
import { getProcessInvocation } from '../../../helpers/process'

const STARTUP_TIMEOUT_SECONDS = 30
const STARTUP_TIMEOUT_MS = STARTUP_TIMEOUT_SECONDS * 1000
const STARTUP_PORT_RETRY_MAX_ATTEMPTS = 4
const HEALTHCHECK_POLL_INTERVAL_MS = 250
const HEALTHCHECK_REQUEST_TIMEOUT_MS = 1000
const TRANSCRIPTION_TIMEOUT_SECONDS = 300
const TRANSCRIPTION_TIMEOUT_MS = TRANSCRIPTION_TIMEOUT_SECONDS * 1000
const DEFAULT_IDLE_STOP_MS = 20 * 60 * 1000
const STALE_SERVER_EXIT_WAIT_MS = 2000
const SERVER_PID_FILE_NAME = 'whisper-server.pid'

const execFileAsync = promisify(execFile)

const isAddressInUseError = (message: string): boolean =>
  /address already in use|eaddrinuse/i.test(message)

const isMissingWhisperDylibError = (details: string): boolean =>
  /Library not loaded:\s*@rpath\/libwhisper\.1\.dylib/i.test(details)

const getServerPidFilePath = (): string => join(getWhisperModelsRootDir(), SERVER_PID_FILE_NAME)

const isPidStillWhisperServer = async (pid: number): Promise<boolean> => {
  try {
    const { stdout } = await execFileAsync('ps', ['-p', String(pid), '-o', 'comm='])
    return basename(stdout.trim()).startsWith('whisper-server')
  } catch {
    return false
  }
}

const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const killStaleServer = async (): Promise<void> => {
  const pid = Number((await readFile(getServerPidFilePath(), 'utf8').catch(() => '')).trim())
  if (!Number.isInteger(pid) || pid <= 0 || !(await isPidStillWhisperServer(pid))) {
    return
  }

  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    return
  }

  const deadline = Date.now() + STALE_SERVER_EXIT_WAIT_MS
  while (isProcessAlive(pid) && Date.now() < deadline) {
    await delay(50)
  }
}

const recordServerPid = async (pid: number | undefined): Promise<void> => {
  if (pid === undefined) {
    return
  }

  await mkdir(getWhisperModelsRootDir(), { recursive: true })
  await writeFile(getServerPidFilePath(), String(pid))
}

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
  private staleServerCleanup: Promise<void> | null = null

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
        method: 'GET',
        signal: AbortSignal.timeout(HEALTHCHECK_REQUEST_TIMEOUT_MS)
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
        clearTimeout(timeoutRef)

        if (error) {
          reject(error)
          return
        }

        resolve()
      })

      const pollUntilHealthy = async (): Promise<void> => {
        while (!settleController.isSettled()) {
          await delay(HEALTHCHECK_POLL_INTERVAL_MS)
          if (!settleController.isSettled() && (await this.checkHealth())) {
            settleController.settle(null)
          }
        }
      }

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

      void pollUntilHealthy()

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

    this.staleServerCleanup ??= killStaleServer()
    await this.staleServerCleanup

    const modelPath = getWhisperModelFilePath(modelId)
    const triedPorts = new Set<number>()

    for (let attempt = 1; attempt <= STARTUP_PORT_RETRY_MAX_ATTEMPTS; attempt += 1) {
      this.port = await findRuntimePort({ exclude: triedPorts })
      const selectedPort = this.port
      triedPorts.add(selectedPort)

      const args = buildWhisperServerArgs({ modelPath, port: this.port })
      const invocation = getProcessInvocation(this.binaryPath, args, 'interactive')

      const processRef = spawn(invocation.command, invocation.args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      })
      this.process = processRef
      this.modelId = modelId
      void recordServerPid(processRef.pid).catch((error) => {
        console.warn('[transcription] failed to record Whisper runtime pid', error)
      })

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

  async transcribe(wavBuffer: Buffer, signal?: AbortSignal): Promise<string> {
    if (!this.isRunning() || this.port === null) {
      throw new Error('Local Whisper runtime is not running.')
    }
    if (signal?.aborted) {
      throw new Error('Local Whisper transcription cancelled.')
    }

    this.clearIdleStopTimer()

    const formData = new FormData()
    const wavBytes = Uint8Array.from(wavBuffer)
    formData.append('file', new Blob([wavBytes], { type: 'audio/wav' }), 'audio.wav')
    formData.append('response_format', 'json')
    formData.append('language', 'auto')

    const abortController = new AbortController()
    let cancelled = false
    const abortListener = (): void => {
      cancelled = true
      abortController.abort('cancelled')
    }
    signal?.addEventListener('abort', abortListener, { once: true })
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
      if (cancelled) {
        throw new Error('Local Whisper transcription cancelled.')
      }
      if (abortController.signal.aborted) {
        throw new Error('Local Whisper transcription timed out.')
      }

      const message = error instanceof Error ? error.message : 'Unknown runtime request failure.'
      throw new Error(`Local Whisper runtime request failed: ${message}`)
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abortListener)
      this.scheduleIdleStop()
    }
  }
}
