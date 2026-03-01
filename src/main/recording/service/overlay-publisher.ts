import { setTimeout as setNodeTimeout } from 'node:timers'
import type { RecordingOverlayState } from '../../../shared/recording'
import { RecordingOverlayController } from '../../overlay/controller'
import { cloneOverlayState, isSameOverlayState } from './overlay-state-helpers'

const AUDIO_LEVELS_PUBLISH_MIN_INTERVAL_MS = 50

/**
 * Applies presentation policy for overlay updates.
 *
 * Immediate updates are used for phase/mode transitions.
 * Audio-level updates are deduped and throttled to reduce BrowserWindow churn.
 */
export class RecordingOverlayPublisher {
  private lastPublishedState: RecordingOverlayState | null = null
  private lastPublishedAt = 0
  private pendingAudioLevelsState: RecordingOverlayState | null = null
  private pendingAudioLevelsTimer: NodeJS.Timeout | null = null

  constructor(
    private readonly overlay: RecordingOverlayController = new RecordingOverlayController()
  ) {}

  async publishImmediate(state: RecordingOverlayState | null): Promise<void> {
    this.clearPendingAudioLevelsTimer()
    this.pendingAudioLevelsState = null
    await this.publishNow(state)
  }

  /**
   * Throttles high-frequency audio-level updates and keeps only the latest pending state.
   */
  async publishAudioLevels(state: RecordingOverlayState | null): Promise<void> {
    if (!state) {
      await this.publishImmediate(null)
      return
    }

    if (isSameOverlayState(this.lastPublishedState, state)) {
      return
    }

    const now = Date.now()
    const elapsedSinceLastPublish = now - this.lastPublishedAt

    if (elapsedSinceLastPublish >= AUDIO_LEVELS_PUBLISH_MIN_INTERVAL_MS) {
      await this.publishNow(state)
      return
    }

    this.pendingAudioLevelsState = cloneOverlayState(state)

    if (this.pendingAudioLevelsTimer) {
      return
    }

    const nextPublishDelayMs = AUDIO_LEVELS_PUBLISH_MIN_INTERVAL_MS - elapsedSinceLastPublish
    this.pendingAudioLevelsTimer = setNodeTimeout(() => {
      this.pendingAudioLevelsTimer = null

      const pendingState = this.pendingAudioLevelsState
      this.pendingAudioLevelsState = null

      if (!pendingState) {
        return
      }

      void this.publishNow(pendingState)
    }, nextPublishDelayMs)
    this.pendingAudioLevelsTimer.unref()
  }

  destroy(): void {
    this.clearPendingAudioLevelsTimer()
    this.pendingAudioLevelsState = null
    this.lastPublishedState = null
    this.overlay.destroy()
  }

  private clearPendingAudioLevelsTimer(): void {
    if (!this.pendingAudioLevelsTimer) {
      return
    }

    clearTimeout(this.pendingAudioLevelsTimer)
    this.pendingAudioLevelsTimer = null
  }

  private async publishNow(state: RecordingOverlayState | null): Promise<void> {
    if (isSameOverlayState(this.lastPublishedState, state)) {
      return
    }

    if (!state) {
      this.overlay.hide()
      this.lastPublishedState = null
      this.lastPublishedAt = Date.now()
      return
    }

    await this.overlay.show(state)
    this.lastPublishedState = cloneOverlayState(state)
    this.lastPublishedAt = Date.now()
  }
}
