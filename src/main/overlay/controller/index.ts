import { BrowserWindow, screen } from 'electron'
import {
  RECORDING_OVERLAY_STATE_CHANNEL,
  type RecordingOverlayState
} from '../../../shared/recording'
import { MacosOverlayVisibilityController } from './macos-visibility'
import {
  OVERLAY_FOLLOW_FAST_INTERVAL_MS,
  OVERLAY_FOLLOW_SLOW_INTERVAL_MS,
  OVERLAY_FOLLOW_STABLE_TICKS_FOR_SLOW,
  positionOverlayOnActiveDisplay
} from './positioning'
import { createOverlayWindow, loadOverlayWindow } from './window-lifecycle'
import { isMacOS } from '../../helpers/platform'

/**
 * Owns the overlay BrowserWindow lifecycle and macOS-specific visibility behavior.
 * Main process publishes state, renderer only renders it.
 */
export class RecordingOverlayController {
  private overlayWindow: BrowserWindow | null = null
  private isRendererReady = false
  private pendingState: RecordingOverlayState | null = null
  private overlayFollowTimer: NodeJS.Timeout | null = null
  private overlayFollowLastDisplayId: number | null = null
  private overlayFollowStableTicks = 0

  private readonly macosVisibility = new MacosOverlayVisibilityController(() => this.overlayWindow)

  private readonly handleDisplayChange = (): void => {
    const overlayWindow = this.getVisibleOverlayWindow()
    if (!overlayWindow) {
      return
    }

    positionOverlayOnActiveDisplay(overlayWindow)
    this.macosVisibility.reassertPassive()
  }

  private readonly handleWorkspaceChange = (): void => {
    const overlayWindow = this.getVisibleOverlayWindow()
    if (!overlayWindow) {
      return
    }

    positionOverlayOnActiveDisplay(overlayWindow)
    this.macosVisibility.reassert(true)
    this.macosVisibility.scheduleSpaceTransitionReassertBurst()
  }

  /**
   * Publish overlay state from main to overlay renderer.
   * Creates the window lazily on first use.
   */
  async show(state: RecordingOverlayState): Promise<void> {
    await this.ensureWindow()

    this.pendingState = state

    if (!this.overlayWindow || !this.isRendererReady) {
      return
    }

    // Send latest state snapshot to overlay renderer over the stable IPC channel.
    this.overlayWindow.webContents.send(RECORDING_OVERLAY_STATE_CHANNEL, state)

    if (!this.overlayWindow.isVisible()) {
      positionOverlayOnActiveDisplay(this.overlayWindow)
      this.overlayWindow.showInactive()
      this.overlayWindow.moveTop()
      this.macosVisibility.reassert(true)
      return
    }

    this.macosVisibility.reassertThrottled()
  }

  /**
   * Hide overlay window without destroying it.
   */
  hide(): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      return
    }

    this.overlayWindow.hide()
  }

  /**
   * Fully destroy window, timers and platform observers.
   */
  destroy(): void {
    this.stopOverlayFollowActiveDisplay()
    this.macosVisibility.clear()

    if (!this.overlayWindow) {
      return
    }

    const windowToDestroy = this.overlayWindow
    this.overlayWindow = null
    this.pendingState = null
    this.isRendererReady = false
    this.detachDisplayObservers()

    if (!windowToDestroy.isDestroyed()) {
      windowToDestroy.destroy()
    }
  }

  /**
   * Create and wire overlay window on demand.
   */
  private async ensureWindow(): Promise<void> {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      return
    }

    this.isRendererReady = false
    this.overlayWindow = createOverlayWindow()

    this.attachDisplayObservers()
    this.macosVisibility.attachWorkspaceObserver(this.handleWorkspaceChange)

    this.overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
    this.overlayWindow.setIgnoreMouseEvents(true, { forward: true })
    this.macosVisibility.applyFullScreenVisibility()

    this.overlayWindow.on('show', () => {
      this.startOverlayFollowActiveDisplay()
    })

    this.overlayWindow.on('hide', () => {
      this.stopOverlayFollowActiveDisplay()
    })

    this.overlayWindow.on('closed', () => {
      this.stopOverlayFollowActiveDisplay()
      this.overlayWindow = null
      this.pendingState = null
      this.isRendererReady = false
      this.detachDisplayObservers()
      this.macosVisibility.clear()
    })

    this.overlayWindow.webContents.on('did-finish-load', () => {
      if (!this.overlayWindow) {
        return
      }

      this.isRendererReady = true

      if (!this.pendingState) {
        return
      }

      this.overlayWindow.webContents.send(RECORDING_OVERLAY_STATE_CHANNEL, this.pendingState)
      positionOverlayOnActiveDisplay(this.overlayWindow)
      this.overlayWindow.showInactive()
      this.overlayWindow.moveTop()
      this.macosVisibility.reassert(true)
    })

    await loadOverlayWindow(this.overlayWindow)
  }

  /**
   * Subscribe display topology events that may require overlay reposition.
   */
  private attachDisplayObservers(): void {
    screen.on('display-added', this.handleDisplayChange)
    screen.on('display-removed', this.handleDisplayChange)
    screen.on('display-metrics-changed', this.handleDisplayChange)
  }

  /**
   * Unsubscribe display topology events.
   */
  private detachDisplayObservers(): void {
    screen.off('display-added', this.handleDisplayChange)
    screen.off('display-removed', this.handleDisplayChange)
    screen.off('display-metrics-changed', this.handleDisplayChange)
  }

  /**
   * Starts adaptive active-display tracking for multi-display macOS setups.
   */
  private startOverlayFollowActiveDisplay(): void {
    if (!isMacOS()) {
      return
    }

    if (this.overlayFollowTimer) {
      return
    }

    if (screen.getAllDisplays().length <= 1) {
      return
    }

    this.overlayFollowLastDisplayId = null
    this.overlayFollowStableTicks = 0
    this.scheduleNextOverlayFollowTick(OVERLAY_FOLLOW_FAST_INTERVAL_MS)
  }

  /**
   * Single follow-loop tick. Uses faster cadence while changing displays and
   * backs off when cursor/display stays stable.
   */
  private runOverlayFollowTick(): void {
    this.overlayFollowTimer = null

    const overlayWindow = this.getVisibleOverlayWindow()
    if (!overlayWindow) {
      return
    }

    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const hasDisplayChanged = this.overlayFollowLastDisplayId !== display.id

    if (hasDisplayChanged) {
      this.overlayFollowLastDisplayId = display.id
      this.overlayFollowStableTicks = 0
      positionOverlayOnActiveDisplay(overlayWindow)
      this.macosVisibility.reassertPassive()
      this.scheduleNextOverlayFollowTick(OVERLAY_FOLLOW_FAST_INTERVAL_MS)
      return
    }

    this.overlayFollowStableTicks += 1
    const nextDelayMs =
      this.overlayFollowStableTicks >= OVERLAY_FOLLOW_STABLE_TICKS_FOR_SLOW
        ? OVERLAY_FOLLOW_SLOW_INTERVAL_MS
        : OVERLAY_FOLLOW_FAST_INTERVAL_MS

    this.scheduleNextOverlayFollowTick(nextDelayMs)
  }

  /**
   * Schedules next follow tick. `unref()` prevents this timer from keeping app
   * process alive during shutdown.
   */
  private scheduleNextOverlayFollowTick(delayMs: number): void {
    if (this.overlayFollowTimer) {
      clearTimeout(this.overlayFollowTimer)
      this.overlayFollowTimer = null
    }

    this.overlayFollowTimer = setTimeout(() => {
      this.runOverlayFollowTick()
    }, delayMs)
    this.overlayFollowTimer.unref()
  }

  /**
   * Stops active-display follow loop and resets follow state.
   */
  private stopOverlayFollowActiveDisplay(): void {
    if (!this.overlayFollowTimer) {
      this.overlayFollowStableTicks = 0
      this.overlayFollowLastDisplayId = null
      return
    }

    clearTimeout(this.overlayFollowTimer)
    this.overlayFollowTimer = null
    this.overlayFollowStableTicks = 0
    this.overlayFollowLastDisplayId = null
  }

  private getLiveOverlayWindow(): BrowserWindow | null {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      return null
    }

    return this.overlayWindow
  }

  private getVisibleOverlayWindow(): BrowserWindow | null {
    const overlayWindow = this.getLiveOverlayWindow()
    if (!overlayWindow || !overlayWindow.isVisible()) {
      return null
    }

    return overlayWindow
  }
}
