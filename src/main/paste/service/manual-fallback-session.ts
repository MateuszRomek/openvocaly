import { createSettleOnce, type SettleOnceController } from '../../helpers/settle-once'
import type { PastePlatformAdapter } from '../platform-adapter'
import type { ManualFallbackOutcome, ManualPasteState } from './types'

type ManualFallbackSessionInput = {
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

  constructor(input: ManualFallbackSessionInput) {
    this.sessionId = input.sessionId
    this.timeoutMs = input.timeoutMs
    this.replayDelayMs = input.replayDelayMs
    this.hint = input.hint
    this.supportsManualPasteWatcher = input.supportsManualPasteWatcher
    this.adapter = input.adapter
    this.onManualPasteState = input.onManualPasteState
  }

  async run(): Promise<ManualFallbackOutcome> {
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
          return
        }
      })
      .catch(() => {})
  }

  private readonly handleManualPasteShortcut = (): void => {
    if (this.isSettled() || this.manualPasteInFlight) {
      return
    }

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

      const probeDecision = this.adapter.evaluateManualPasteProbe?.(probeResult)
      if (probeDecision?.shouldIgnoreManualPaste) {
        return
      }

      // Ensure replayed Cmd/Ctrl+V is not swallowed by our global shortcut watcher.
      this.adapter.stopManualPasteWatcher()

      const pasteResult = await this.adapter.simulatePasteShortcut()

      if (!pasteResult.ok || this.isSettled()) {
        if (!this.isSettled()) {
          this.startManualWatcher()
        }
        return
      }

      this.settle({ type: 'manual_paste_success' })
    } catch {
      // Ignore replay failures and keep session running.
    } finally {
      this.manualPasteInFlight = false
    }
  }

  private settle(outcome: ManualFallbackOutcome): boolean {
    if (!this.settleController) {
      return false
    }

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
