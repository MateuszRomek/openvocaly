import { randomUUID } from 'node:crypto'
import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'
import { resolveQwenMlxHostPath } from './runtime-discovery'

type HostCommand = 'warm' | 'transcribe' | 'unload'

type HostRequest = {
  id: string
  command: HostCommand
  modelDirectory?: string
  filePath?: string
}

type HostResponse = {
  id: string
  ok: boolean
  text?: string
  language?: string
  durationMs?: number
  error?: string
}

type PendingRequest = {
  resolve: (response: HostResponse) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

export type QwenMlxHostTranscription = {
  text: string
  language?: string
  durationMs?: number
}

const WARM_TIMEOUT_MS = 3 * 60 * 1000
const TRANSCRIBE_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Owns a single app-bundled MLX process. Its protocol is deliberately narrow
 * so model download, IPC, and process lifecycle remain separate concerns.
 */
export class QwenMlxHostClient {
  private process: ChildProcessByStdio<Writable, Readable, Readable> | null = null
  private startPromise: Promise<void> | null = null
  private stdoutBuffer = ''
  private stderrOutput = ''
  private readonly pendingRequests = new Map<string, PendingRequest>()

  isAvailable(): boolean {
    return resolveQwenMlxHostPath() !== null
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed
  }

  async warm(modelDirectory: string): Promise<void> {
    await this.request('warm', { modelDirectory }, WARM_TIMEOUT_MS)
  }

  async transcribe(modelDirectory: string, filePath: string): Promise<QwenMlxHostTranscription> {
    const response = await this.request(
      'transcribe',
      { modelDirectory, filePath },
      TRANSCRIBE_TIMEOUT_MS
    )
    return {
      text: response.text?.trim() ?? '',
      language: response.language,
      durationMs: response.durationMs
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
        processRef.kill('SIGKILL')
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
    timeoutMs: number
  ): Promise<HostResponse> {
    await this.ensureStarted()
    const processRef = this.process
    if (!processRef?.stdin.writable) {
      throw new Error('The Qwen MLX host is not available.')
    }

    const id = randomUUID()
    const request: HostRequest = { id, command, ...params }
    return await new Promise<HostResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Qwen MLX host ${command} command timed out.`))
      }, timeoutMs)
      this.pendingRequests.set(id, { resolve, reject, timeout })
      processRef.stdin.write(`${JSON.stringify(request)}\n`, (error) => {
        if (error) {
          this.rejectRequest(id, new Error(`Failed to send Qwen MLX command: ${error.message}`))
        }
      })
    }).then((response) => {
      if (!response.ok) {
        throw new Error(response.error || `Qwen MLX host ${command} command failed.`)
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

    const binaryPath = resolveQwenMlxHostPath()
    if (!binaryPath) {
      throw new Error('The Qwen MLX host is unavailable. Reinstall the app.')
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
        reject(new Error(`Failed to start Qwen MLX host: ${error.message}`))
      })
      processRef.once('close', (code, signal) => {
        if (this.process === processRef) {
          this.process = null
        }
        this.startPromise = null
        const details = this.stderrOutput.trim()
        const error = new Error(
          `Qwen MLX host exited (${signal ? `signal ${signal}` : `code ${code}`})${
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
        clearTimeout(pending.timeout)
        this.pendingRequests.delete(response.id)
        pending.resolve(response)
      } catch {
        // Third-party runtime logging cannot affect the JSON-line protocol.
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
