import { randomUUID } from 'node:crypto'
import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'
import { resolveMacOSAsrHostPath } from './runtime-discovery'

type HostCommand = 'install' | 'warm' | 'transcribe' | 'unload'

type HostRequest = {
  id: string
  command: HostCommand
  modelDirectory?: string
  filePath?: string
}

type HostResponse = {
  id: string
  ok: boolean
  event?: 'progress' | null
  percentage?: number | null
  text?: string | null
  confidence?: number | null
  durationMs?: number | null
  error?: string | null
}

type PendingRequest = {
  resolve: (response: HostResponse) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
  onProgress?: (percentage: number) => void
}

export type MacOSAsrHostTranscription = {
  text: string
  confidence?: number
  durationMs?: number
}

const INSTALL_TIMEOUT_MS = 30 * 60 * 1000
const WARM_TIMEOUT_MS = 90 * 1000
const TRANSCRIBE_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Owns one native process and a narrow request/response protocol. Keeping the
 * process alive preserves the compiled CoreML model between dictations.
 */
export class MacOSAsrHostClient {
  private process: ChildProcessByStdio<Writable, Readable, Readable> | null = null
  private startPromise: Promise<void> | null = null
  private stdoutBuffer = ''
  private stderrOutput = ''
  private readonly pendingRequests = new Map<string, PendingRequest>()

  isAvailable(): boolean {
    return resolveMacOSAsrHostPath() !== null
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed
  }

  async install(modelDirectory: string, onProgress?: (percentage: number) => void): Promise<void> {
    await this.request('install', { modelDirectory }, INSTALL_TIMEOUT_MS, onProgress)
  }

  async warm(modelDirectory: string): Promise<void> {
    await this.request('warm', { modelDirectory }, WARM_TIMEOUT_MS)
  }

  async transcribe(modelDirectory: string, filePath: string): Promise<MacOSAsrHostTranscription> {
    const response = await this.request(
      'transcribe',
      { modelDirectory, filePath },
      TRANSCRIBE_TIMEOUT_MS
    )
    return {
      text: response.text?.trim() ?? '',
      confidence: response.confidence ?? undefined,
      durationMs: response.durationMs ?? undefined
    }
  }

  async stop(): Promise<void> {
    const processRef = this.process
    this.process = null
    this.startPromise = null

    if (!processRef) {
      return
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        try {
          processRef.kill('SIGKILL')
        } catch {
          // The process is already gone.
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
  }

  private async request(
    command: HostCommand,
    params: Pick<HostRequest, 'modelDirectory' | 'filePath'>,
    timeoutMs: number,
    onProgress?: (percentage: number) => void
  ): Promise<HostResponse> {
    await this.ensureStarted()
    const processRef = this.process
    if (!processRef?.stdin.writable) {
      throw new Error('The macOS ASR host is not available.')
    }

    const id = randomUUID()
    const request: HostRequest = { id, command, ...params }

    return await new Promise<HostResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`macOS ASR host ${command} command timed out.`))
      }, timeoutMs)

      this.pendingRequests.set(id, { resolve, reject, timeout, onProgress })
      processRef.stdin.write(`${JSON.stringify(request)}\n`, (error) => {
        if (!error) {
          return
        }
        this.rejectRequest(
          id,
          new Error(`Failed to send command to macOS ASR host: ${error.message}`)
        )
      })
    }).then((response) => {
      if (!response.ok) {
        throw new Error(response.error || `macOS ASR host ${command} command failed.`)
      }
      return response
    })
  }

  private async ensureStarted(): Promise<void> {
    if (this.isRunning()) {
      return
    }

    if (this.startPromise) {
      return await this.startPromise
    }

    const binaryPath = resolveMacOSAsrHostPath()
    if (!binaryPath) {
      throw new Error('The macOS ASR host binary is unavailable. Reinstall the app.')
    }

    this.startPromise = new Promise<void>((resolve, reject) => {
      const processRef = spawn(binaryPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      })
      this.process = processRef
      this.stdoutBuffer = ''
      this.stderrOutput = ''

      processRef.stdout.on('data', (chunk) => this.handleStdout(String(chunk)))
      processRef.stderr.on('data', (chunk) => {
        this.stderrOutput = `${this.stderrOutput}${String(chunk)}`.slice(-2000)
      })
      processRef.once('spawn', resolve)
      processRef.once('error', (error) => {
        this.process = null
        reject(new Error(`Failed to start macOS ASR host: ${error.message}`))
      })
      processRef.once('close', (code, signal) => {
        if (this.process === processRef) {
          this.process = null
        }
        this.startPromise = null
        const details = this.stderrOutput.trim()
        const error = new Error(
          `macOS ASR host exited (${signal ? `signal ${signal}` : `code ${code}`})${
            details ? `: ${details}` : ''
          }`
        )
        for (const id of this.pendingRequests.keys()) {
          this.rejectRequest(id, error)
        }
      })
    })

    try {
      await this.startPromise
    } catch (error) {
      this.startPromise = null
      throw error
    }
  }

  private handleStdout(chunk: string): void {
    this.stdoutBuffer += chunk
    const lines = this.stdoutBuffer.split('\n')
    this.stdoutBuffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) {
        continue
      }

      try {
        const response = JSON.parse(line) as HostResponse
        const pending = this.pendingRequests.get(response.id)
        if (!pending) {
          continue
        }
        if (response.event === 'progress') {
          pending.onProgress?.(Math.max(0, Math.min(100, response.percentage ?? 0)))
          continue
        }
        clearTimeout(pending.timeout)
        this.pendingRequests.delete(response.id)
        pending.resolve(response)
      } catch {
        // Native-library logging is ignored; only structured replies carry request ids.
      }
    }
  }

  private rejectRequest(id: string, error: Error): void {
    const pending = this.pendingRequests.get(id)
    if (!pending) {
      return
    }
    clearTimeout(pending.timeout)
    this.pendingRequests.delete(id)
    pending.reject(error)
  }
}
