import { createSettleOnce, type SettleOnceController } from '../../helpers/settle-once'
import { createLogger } from '../../helpers/logger'
import type { PastePlatformAdapter } from '../platform-adapter'
import type { ManualFallbackOutcome, ManualPasteState } from './types'
import { toSessionTargetApp } from './target-app'

type ManualFallbackSessionOptions = {
  sessionId: string
  timeoutMs: number
  replayDelayMs: number
  hint: string
  supportsManualPasteWatcher: boolean
  adapter: PastePlatformAdapter
  onManualPasteState: (state: ManualPasteState) => Promise<void> | void
}

/**
 * Generic manual-paste fallback session used by all platforms.
 * Platform-specific target validation stays behind `PastePlatformAdapter`.
 */
export class ManualFallbackSession {
  private readonly logger = createLogger('paste.manual-fallback')
  readonly sessionId: string
  private readonly timeoutMs: number
  private readonly replayDelayMs: number
  private readonly hint: string
  private readonly supportsManualPasteWatcher: boolean
  private readonly adapter: PastePlatformAdapter
  private readonly onManualPasteState: (state: ManualPasteState) => Promise<void> | void

  private settleController: SettleOnceController<ManualFallbackOutcome> | null = null
  private cleanupFns: Array<() => void> = []
  private manualPasteInFlight = false

  constructor(options: ManualFallbackSessionOptions) {
    this.sessionId = options.sessionId
    this.timeoutMs = options.timeoutMs
    this.replayDelayMs = options.replayDelayMs
    this.hint = options.hint
    this.supportsManualPasteWatcher = options.supportsManualPasteWatcher
    this.adapter = options.adapter
    this.onManualPasteState = options.onManualPasteState
  }

  async run(): Promise<ManualFallbackOutcome> {
    this.logger.debug({
      sessionId: this.sessionId,
      timeoutMs: this.timeoutMs,
      supportsManualPasteWatcher: this.supportsManualPasteWatcher,
      event: 'manual_fallback_start'
    })
    await this.onManualPasteState({
      remainingMs: this.timeoutMs,
      timeoutMs: this.timeoutMs,
      hint: this.hint
    })

    return await new Promise((resolve) => {
      this.settleController = createSettleOnce<ManualFallbackOutcome>((outcome) => {
        this.dispose()
        resolve(outcome)
      })

      this.addCleanup(() => {
        this.adapter.stopManualPasteWatcher()
      })

      this.startTimeout()
      this.startCountdown()

      if (this.supportsManualPasteWatcher) {
        this.startManualWatcher()
      }
    })
  }

  cancel(): boolean {
    return this.settle({ type: 'manual_cancelled' })
  }

  private startTimeout(): void {
    const timeoutTimer = setTimeout(() => {
      this.settle({ type: 'manual_timeout' })
    }, this.timeoutMs)
    timeoutTimer.unref()

    this.addCleanup(() => {
      clearTimeout(timeoutTimer)
    })
  }

  private startCountdown(): void {
    const startedAt = Date.now()
    let lastSecondRemaining = Math.ceil(this.timeoutMs / 1000)

    const tickTimer = setInterval(() => {
      const elapsed = Date.now() - startedAt
      const remainingMs = Math.max(0, this.timeoutMs - elapsed)
      const nextSecondRemaining = Math.ceil(remainingMs / 1000)
      if (nextSecondRemaining === lastSecondRemaining) {
        return
      }

      lastSecondRemaining = nextSecondRemaining
      void this.onManualPasteState({
        remainingMs,
        timeoutMs: this.timeoutMs,
        hint: this.hint
      })
    }, 120)
    tickTimer.unref()

    this.addCleanup(() => {
      clearInterval(tickTimer)
    })
  }

  private startManualWatcher(): void {
    void this.adapter
      .startManualPasteWatcher(this.handleManualPasteShortcut)
      .then((result) => {
        if (this.isSettled()) {
          if (result.ok) {
            this.adapter.stopManualPasteWatcher()
          }
          return
        }

        if (result.ok) {
          this.logger.debug({
            sessionId: this.sessionId,
            event: 'manual_watcher_ready'
          })
          return
        }

        this.logger.warn({
          sessionId: this.sessionId,
          message: result.message ?? 'manual watcher failed to start',
          event: 'manual_watcher_start_failed'
        })
      })
      .catch((error) => {
        this.logger.warn({
          sessionId: this.sessionId,
          message: error instanceof Error ? error.message : 'manual watcher start threw',
          event: 'manual_watcher_start_error'
        })
      })
  }

  private readonly handleManualPasteShortcut = (): void => {
    if (this.isSettled() || this.manualPasteInFlight) {
      return
    }

    this.logger.debug({
      sessionId: this.sessionId,
      event: 'manual_shortcut_detected'
    })
    this.manualPasteInFlight = true
    const replayTimer = setTimeout(() => {
      if (this.isSettled()) {
        this.manualPasteInFlight = false
        return
      }

      void this.replayManualPasteShortcut()
    }, this.replayDelayMs)
    replayTimer.unref()
  }

  private async replayManualPasteShortcut(): Promise<void> {
    try {
      const probeResult = await this.adapter.probeEditableTarget()
      this.logger.debug({
        sessionId: this.sessionId,
        probeResult,
        event: 'manual_replay_probe_result'
      })

      const probeDecision = this.adapter.evaluateManualPasteProbe?.(probeResult)
      if (probeDecision?.shouldIgnoreManualPaste) {
        this.logger.debug({
          sessionId: this.sessionId,
          reason: probeDecision.reason ?? null,
          event: 'manual_replay_ignored'
        })
        return
      }

      // Ensure replayed Cmd/Ctrl+V is not swallowed by our global shortcut watcher.
      this.adapter.stopManualPasteWatcher()

      const pasteResult = await this.adapter.simulatePasteShortcut()
      this.logger.debug({
        sessionId: this.sessionId,
        pasteResult,
        event: 'manual_replay_result'
      })

      if (!pasteResult.ok || this.isSettled()) {
        if (!this.isSettled()) {
          this.startManualWatcher()
        }
        return
      }

      this.settle({
        type: 'manual_paste_success',
        targetApp: toSessionTargetApp(probeResult)
      })
    } catch (error) {
      this.logger.warn({
        sessionId: this.sessionId,
        message: error instanceof Error ? error.message : 'manual replay threw',
        event: 'manual_replay_error'
      })
      // Ignore replay failures and keep session running.
    } finally {
      this.manualPasteInFlight = false
    }
  }

  private settle(outcome: ManualFallbackOutcome): boolean {
    if (!this.settleController) {
      return false
    }

    this.logger.debug({
      sessionId: this.sessionId,
      outcome: outcome.type,
      event: 'manual_fallback_settle'
    })
    return this.settleController.settle(outcome)
  }

  private isSettled(): boolean {
    if (!this.settleController) {
      return true
    }

    return this.settleController.isSettled()
  }

  private addCleanup(fn: () => void): void {
    this.cleanupFns.push(fn)
  }

  private dispose(): void {
    const callbacks = this.cleanupFns.slice().reverse()
    this.cleanupFns = []
    for (const callback of callbacks) {
      try {
        callback()
      } catch {
        // Best effort cleanup.
      }
    }
  }
}
