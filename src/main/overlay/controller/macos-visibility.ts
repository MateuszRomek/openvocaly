import { systemPreferences, type BrowserWindow } from 'electron'
import { isMacOS } from '../../helpers/platform'

// Minimum gap between passive visibility reasserts during frequent overlay updates.
const OVERLAY_REASSERT_THROTTLE_MS = 180
// One delayed retry after explicit surfacing to catch transient z-order races.
const OVERLAY_REASSERT_DELAY_MS = 45
// A short sequence of retries around Space transition animation (0ms, 70ms, 170ms).
const OVERLAY_SPACE_REASSERT_DELAYS_MS = [0, 70, 170] as const
const OVERLAY_ALWAYS_ON_TOP_RELATIVE_LEVEL = 1

type WindowGetter = () => BrowserWindow | null

/**
 * Handles macOS-specific overlay visibility quirks (Spaces/fullscreen/z-order reasserts).
 */
export class MacosOverlayVisibilityController {
  private macSpaceSubscriptionId: number | null = null
  private delayedReassertTimer: NodeJS.Timeout | null = null
  private spaceReassertTimers: NodeJS.Timeout[] = []
  private lastVisibilityReassertAt = 0

  constructor(private readonly getWindow: WindowGetter) {}

  /**
   * Subscribes to active Space/workspace changes on macOS.
   * Used to re-assert overlay visibility when the user switches Spaces.
   */
  attachWorkspaceObserver(onWorkspaceChange: () => void): void {
    if (!isMacOS() || this.macSpaceSubscriptionId !== null) {
      return
    }

    this.macSpaceSubscriptionId = systemPreferences.subscribeWorkspaceNotification(
      'NSWorkspaceActiveSpaceDidChangeNotification',
      onWorkspaceChange
    )
  }

  detachWorkspaceObserver(): void {
    if (!isMacOS() || this.macSpaceSubscriptionId === null) {
      return
    }

    systemPreferences.unsubscribeWorkspaceNotification(this.macSpaceSubscriptionId)
    this.macSpaceSubscriptionId = null
  }

  applyFullScreenVisibility(): void {
    if (!isMacOS()) {
      return
    }

    const overlayWindow = this.getLiveWindow()
    if (!overlayWindow) {
      return
    }

    overlayWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true
    })
  }

  /**
   * Aggressively brings the overlay above other windows without stealing focus.
   * `scheduleDelayed` adds one follow-up reassert for transient z-order races.
   */
  reassert(scheduleDelayed = false): void {
    const overlayWindow = this.getLiveWindow()
    if (!overlayWindow) {
      return
    }

    this.pinAlwaysOnTop(overlayWindow)

    if (!isMacOS()) {
      return
    }

    this.applyFullScreenVisibility()
    // Show window without activation so typing focus stays in the current app.
    overlayWindow.showInactive()
    overlayWindow.moveTop()

    if (scheduleDelayed) {
      this.scheduleDelayedReassert()
    }
  }

  /**
   * Lightweight reassert used in tight loops and timer bursts.
   * Keeps always-on-top/fullscreen flags current but avoids window surfacing
   * (i.e. it does not force show/move-to-top operations).
   */
  reassertPassive(): void {
    const overlayWindow = this.getLiveWindow()
    if (!overlayWindow) {
      return
    }

    this.pinAlwaysOnTop(overlayWindow)

    if (!isMacOS()) {
      return
    }

    this.applyFullScreenVisibility()
  }

  /**
   * Guards passive reasserts so repeated events do not flood window operations.
   */
  reassertThrottled(): void {
    const now = Date.now()
    if (now - this.lastVisibilityReassertAt <= OVERLAY_REASSERT_THROTTLE_MS) {
      return
    }

    this.reassertPassive()
    this.lastVisibilityReassertAt = now
  }

  /**
   * Runs a small delayed burst across Space transitions because macOS may
   * momentarily drop always-on-top/fullscreen flags during the animation.
   */
  scheduleSpaceTransitionReassertBurst(): void {
    this.clearSpaceReassertTimers()

    this.spaceReassertTimers = OVERLAY_SPACE_REASSERT_DELAYS_MS.map((delayMs) =>
      setTimeout(() => {
        const overlayWindow = this.getLiveWindow()
        if (!overlayWindow || !overlayWindow.isVisible()) {
          return
        }

        this.reassertPassive()
      }, delayMs)
    )

    for (const timer of this.spaceReassertTimers) {
      // Allow app shutdown even when delayed retries are still pending.
      timer.unref()
    }
  }

  clear(): void {
    this.clearDelayedReassertTimer()
    this.clearSpaceReassertTimers()
    this.detachWorkspaceObserver()
  }

  private scheduleDelayedReassert(): void {
    this.clearDelayedReassertTimer()

    this.delayedReassertTimer = setTimeout(() => {
      this.delayedReassertTimer = null

      const overlayWindow = this.getLiveWindow()
      if (!overlayWindow || !overlayWindow.isVisible()) {
        return
      }

      this.reassertPassive()
    }, OVERLAY_REASSERT_DELAY_MS)
    // Allow app shutdown even when delayed retry is still pending.
    this.delayedReassertTimer.unref()
  }

  private clearDelayedReassertTimer(): void {
    if (!this.delayedReassertTimer) {
      return
    }

    clearTimeout(this.delayedReassertTimer)
    this.delayedReassertTimer = null
  }

  private clearSpaceReassertTimers(): void {
    if (!this.spaceReassertTimers.length) {
      return
    }

    for (const timer of this.spaceReassertTimers) {
      clearTimeout(timer)
    }

    this.spaceReassertTimers = []
  }

  private getLiveWindow(): BrowserWindow | null {
    const overlayWindow = this.getWindow()
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      return null
    }

    return overlayWindow
  }

  private pinAlwaysOnTop(overlayWindow: BrowserWindow): void {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver', OVERLAY_ALWAYS_ON_TOP_RELATIVE_LEVEL)
  }
}
