import { randomUUID } from 'node:crypto'
import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'
import { getProcessInvocation } from '../../helpers/process'

export type HostCommand = 'install' | 'warm' | 'transcribe' | 'unload'

export type HostReply = {
  id: string
  ok: boolean
  event?: 'progress' | null
  percentage?: number | null
  error?: string | null
}

type PendingRequest = {
  command: HostCommand
  timeout: NodeJS.Timeout
  onProgress?: (percentage: number) => void
  removeAbortListener?: () => void
  settle: (outcome: { reply: HostReply } | { error: Error }) => void
}

type HostSession = {
  process: ChildProcessByStdio<Writable, Readable, Readable>
  pending: Map<string, PendingRequest>
  stdoutBuffer: string
  stderrOutput: string
  modelLoaded: boolean
  idleTimer: NodeJS.Timeout | null
  closed: Promise<void>
}

export const HOST_IDLE_UNLOAD_MS = 20 * 60 * 1000
const UNLOAD_TIMEOUT_MS = 30 * 1000
const STOP_GRACE_MS = 5000

export class JsonLineHostClient<TReply extends HostReply> {
  private session: HostSession | null = null
  private starting: Promise<HostSession> | null = null

  constructor(
    private readonly options: {
      label: string
      resolveBinaryPath: () => string | null
      missingBinaryMessage: string
    }
  ) {}

  isAvailable(): boolean {
    return this.options.resolveBinaryPath() !== null
  }

  isRunning(): boolean {
    return this.session !== null
  }

  async request(
    command: HostCommand,
    params: { modelDirectory?: string; filePath?: string },
    options: { timeoutMs: number; onProgress?: (percentage: number) => void; signal?: AbortSignal }
  ): Promise<TReply> {
    const { label } = this.options
    const { signal } = options
    const cancelledError = (): Error => new Error(`${label} ${command} command cancelled.`)
    if (signal?.aborted) {
      throw cancelledError()
    }
    const session = await this.ensureSession()
    if (signal?.aborted) {
      throw cancelledError()
    }
    if (!session.process.stdin.writable) {
      throw new Error(`The ${label} is not available.`)
    }

    this.clearIdleTimer(session)
    const id = randomUUID()
    const reply = await new Promise<HostReply>((resolve, reject) => {
      let settled = false
      const pending: PendingRequest = {
        command,
        onProgress: options.onProgress,
        timeout: setTimeout(() => {
          pending.settle({ error: new Error(`${label} ${command} command timed out.`) })
          void this.terminate(session)
        }, options.timeoutMs),
        settle: (outcome) => {
          if (settled) {
            return
          }
          settled = true
          pending.removeAbortListener?.()
          if ('error' in outcome) {
            reject(outcome.error)
          } else {
            resolve(outcome.reply)
          }
        }
      }
      if (signal) {
        const abortListener = (): void => pending.settle({ error: cancelledError() })
        signal.addEventListener('abort', abortListener, { once: true })
        pending.removeAbortListener = () => signal.removeEventListener('abort', abortListener)
      }

      session.pending.set(id, pending)
      session.process.stdin.write(`${JSON.stringify({ id, command, ...params })}\n`, (error) => {
        if (error) {
          this.finishRequest(session, id, {
            error: new Error(`Failed to send command to ${label}: ${error.message}`)
          })
        }
      })
    })

    if (!reply.ok) {
      throw new Error(reply.error || `${label} ${command} command failed.`)
    }
    return reply as TReply
  }

  async stop(): Promise<void> {
    const session = this.session
    this.starting = null
    if (session) {
      await this.terminate(session)
    }
  }

  private async terminate(session: HostSession): Promise<void> {
    if (this.session === session) {
      this.session = null
    }
    this.clearIdleTimer(session)
    const forceKill = setTimeout(() => session.process.kill('SIGKILL'), STOP_GRACE_MS)
    session.process.kill('SIGTERM')
    await session.closed
    clearTimeout(forceKill)
  }

  private async ensureSession(): Promise<HostSession> {
    if (this.starting) {
      return await this.starting
    }
    if (this.session) {
      return this.session
    }
    const starting = this.spawnSession().finally(() => {
      if (this.starting === starting) {
        this.starting = null
      }
    })
    this.starting = starting
    return await starting
  }

  private spawnSession(): Promise<HostSession> {
    const binaryPath = this.options.resolveBinaryPath()
    if (!binaryPath) {
      return Promise.reject(new Error(this.options.missingBinaryMessage))
    }

    const invocation = getProcessInvocation(binaryPath, [], 'interactive')
    const processRef = spawn(invocation.command, invocation.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })
    let markClosed: () => void = () => undefined
    const session: HostSession = {
      process: processRef,
      pending: new Map(),
      stdoutBuffer: '',
      stderrOutput: '',
      modelLoaded: false,
      idleTimer: null,
      closed: new Promise<void>((resolve) => {
        markClosed = resolve
      })
    }
    this.session = session

    // A write to an exiting host fails through the write callback; without a
    // listener the stream's EPIPE 'error' event would crash the main process.
    processRef.stdin.on('error', () => undefined)
    processRef.stdout.on('data', (chunk) => this.handleStdout(session, String(chunk)))
    processRef.stderr.on('data', (chunk) => {
      session.stderrOutput = `${session.stderrOutput}${String(chunk)}`.slice(-2000)
    })

    const handleExit = (error: Error): void => {
      if (this.session === session) {
        this.session = null
      }
      this.clearIdleTimer(session)
      for (const id of [...session.pending.keys()]) {
        this.finishRequest(session, id, { error })
      }
      markClosed()
    }
    processRef.once('close', (code, signal) => {
      const details = session.stderrOutput.trim()
      handleExit(
        new Error(
          `${this.options.label} exited (${signal ? `signal ${signal}` : `code ${code}`})${
            details ? `: ${details}` : ''
          }`
        )
      )
    })

    return new Promise<HostSession>((resolve, reject) => {
      processRef.once('spawn', () => resolve(session))
      processRef.once('error', (error) => {
        const startError = new Error(`Failed to start ${this.options.label}: ${error.message}`)
        handleExit(startError)
        reject(startError)
      })
    })
  }

  private handleStdout(session: HostSession, chunk: string): void {
    session.stdoutBuffer += chunk
    const lines = session.stdoutBuffer.split('\n')
    session.stdoutBuffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) {
        continue
      }
      let reply: HostReply
      try {
        reply = JSON.parse(line) as HostReply
      } catch {
        continue
      }
      const pending = session.pending.get(reply.id)
      if (!pending) {
        continue
      }
      if (reply.event === 'progress') {
        pending.onProgress?.(Math.max(0, Math.min(100, reply.percentage ?? 0)))
        continue
      }
      if (reply.ok && (pending.command === 'warm' || pending.command === 'transcribe')) {
        session.modelLoaded = true
      } else if (reply.ok && pending.command === 'unload') {
        session.modelLoaded = false
      }
      this.finishRequest(session, reply.id, { reply })
    }
  }

  private finishRequest(
    session: HostSession,
    id: string,
    outcome: { reply: HostReply } | { error: Error }
  ): void {
    const pending = session.pending.get(id)
    if (!pending) {
      return
    }
    clearTimeout(pending.timeout)
    session.pending.delete(id)
    pending.settle(outcome)
    this.scheduleIdleUnload(session)
  }

  private scheduleIdleUnload(session: HostSession): void {
    this.clearIdleTimer(session)
    if (!session.modelLoaded || session.pending.size > 0 || this.session !== session) {
      return
    }
    session.idleTimer = setTimeout(() => {
      session.idleTimer = null
      if (this.session !== session || session.pending.size > 0) {
        return
      }
      void this.request('unload', {}, { timeoutMs: UNLOAD_TIMEOUT_MS }).catch((error) => {
        console.error(`[transcription] failed to unload idle ${this.options.label}`, error)
      })
    }, HOST_IDLE_UNLOAD_MS)
    session.idleTimer.unref()
  }

  private clearIdleTimer(session: HostSession): void {
    if (session.idleTimer) {
      clearTimeout(session.idleTimer)
      session.idleTimer = null
    }
  }
}
