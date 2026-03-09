import { setTimeout as setNodeTimeout } from 'node:timers'

/**
 * Small lifecycle wrapper around a single idle-reset timer.
 * Ensures only one pending reset callback exists at a time.
 */
export class DictationIdleResetController {
  private timeout: NodeJS.Timeout | null = null

  clear(): void {
    if (!this.timeout) {
      return
    }

    clearTimeout(this.timeout)
    this.timeout = null
  }

  schedule(delayMs: number, callback: () => void): void {
    this.clear()

    this.timeout = setNodeTimeout(() => {
      this.timeout = null
      callback()
    }, delayMs)
    this.timeout.unref()
  }

  destroy(): void {
    this.clear()
  }
}

export const dictationIdleResetController = new DictationIdleResetController()
