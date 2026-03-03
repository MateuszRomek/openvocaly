import { BrowserWindow, screen, type Rectangle } from 'electron'
import {
  DICTATION_OVERLAY_STATE_CHANNEL,
  type DictationOverlayState
} from '../../../shared/dictation'
import { MacosOverlayVisibilityController } from './macos-visibility'
import {
  OVERLAY_FOLLOW_FAST_INTERVAL_MS,
  OVERLAY_FOLLOW_SLOW_INTERVAL_MS,
  OVERLAY_FOLLOW_STABLE_TICKS_FOR_SLOW,
  resolveOverlayBoundsOnActiveDisplay,
  resolveOverlaySizeForState
} from './positioning'
import { createOverlayWindow, loadOverlayWindow } from './window-lifecycle'
import { isMacOS } from '../../helpers/platform'

const OVERLAY_RESIZE_DURATION_MS = 300
const OVERLAY_LAYOUT_EPSILON_PX = 1
const OVERLAY_ANIMATION_FALLBACK_HZ = 60
const OVERLAY_ANIMATION_MIN_HZ = 30
const OVERLAY_ANIMATION_MAX_HZ = 144

/**
 * Module ownership:
 * - Owns overlay BrowserWindow lifecycle, readiness, and display-follow loop.
 * - Does not own bar rendering math (renderer) or macOS z-order retry policy internals.
 */
/**
 * Owns the overlay BrowserWindow lifecycle and macOS-specific visibility behavior.
 * Main process publishes state, renderer only renders it.
 */
export class RecordingOverlayController {
  private overlayWindow: BrowserWindow | null = null
  private isRendererReady = false
  private pendingState: DictationOverlayState | null = null
  private overlayFollowTimer: NodeJS.Timeout | null = null
  private overlayFollowLastDisplayId: number | null = null
  private overlayFollowStableTicks = 0
  private resizeAnimationTimer: NodeJS.Timeout | null = null

  private readonly macosVisibility = new MacosOverlayVisibilityController(() => this.overlayWindow)

  private readonly handleDisplayChange = (): void => {
    const overlayWindow = this.getVisibleOverlayWindow()
    if (!overlayWindow) {
      return
    }

    this.applyOverlayLayout({ state: this.pendingState, animate: false })
    this.macosVisibility.reassertPassive()
  }

  private readonly handleWorkspaceChange = (): void => {
    const overlayWindow = this.getVisibleOverlayWindow()
    if (!overlayWindow) {
      return
    }

    this.applyOverlayLayout({ state: this.pendingState, animate: false })
    this.macosVisibility.reassert(true)
    this.macosVisibility.scheduleSpaceTransitionReassertBurst()
  }

  /**
   * Publish overlay state from main to overlay renderer.
   * Creates the window lazily on first use.
   */
  async show(state: DictationOverlayState): Promise<void> {
    await this.ensureWindow()

    this.pendingState = state

    if (!this.overlayWindow || !this.isRendererReady) {
      return
    }

    // Send latest state snapshot to overlay renderer over the stable IPC channel.
    this.overlayWindow.webContents.send(DICTATION_OVERLAY_STATE_CHANNEL, state)

    const wasVisible = this.overlayWindow.isVisible()
    this.applyOverlayLayout({ state, animate: wasVisible })

    if (!wasVisible) {
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

    this.clearResizeAnimationTimer()
    this.overlayWindow.hide()
  }

  /**
   * Fully destroy window, timers and platform observers.
   */
  destroy(): void {
    this.stopOverlayFollowActiveDisplay()
    this.clearResizeAnimationTimer()
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
      this.applyOverlayPerformanceMode(false)
      this.startOverlayFollowActiveDisplay()
    })

    this.overlayWindow.on('hide', () => {
      this.applyOverlayPerformanceMode(true)
      this.stopOverlayFollowActiveDisplay()
    })

    this.overlayWindow.on('closed', () => {
      this.stopOverlayFollowActiveDisplay()
      this.clearResizeAnimationTimer()
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

      this.overlayWindow.webContents.send(DICTATION_OVERLAY_STATE_CHANNEL, this.pendingState)
      this.applyOverlayLayout({ state: this.pendingState, animate: false })
      this.overlayWindow.showInactive()
      this.overlayWindow.moveTop()
      this.macosVisibility.reassert(true)
    })

    await loadOverlayWindow(this.overlayWindow)
    this.applyOverlayPerformanceMode(true)
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
      this.applyOverlayLayout({ state: this.pendingState, animate: false })
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

  private applyOverlayLayout(input: {
    state: Pick<DictationOverlayState, 'phase' | 'failureReason' | 'message'> | null
    animate: boolean
  }): void {
    const overlayWindow = this.getLiveOverlayWindow()
    if (!overlayWindow) {
      return
    }

    const targetSize = resolveOverlaySizeForState(input.state)
    const targetBounds = resolveOverlayBoundsOnActiveDisplay(targetSize)

    if (!input.animate || !overlayWindow.isVisible()) {
      this.clearResizeAnimationTimer()
      overlayWindow.setBounds(targetBounds)
      return
    }

    const currentBounds = overlayWindow.getBounds()
    if (this.isCloseEnough(currentBounds, targetBounds)) {
      return
    }

    this.animateOverlayBounds(currentBounds, targetBounds)
  }

  private animateOverlayBounds(from: Rectangle, to: Rectangle): void {
    this.clearResizeAnimationTimer()
    const startedAt = performance.now()
    const frameDurationMs = this.resolveAnimationFrameDurationMs(from)
    let nextFrameAt = startedAt + frameDurationMs

    const step = (): void => {
      const overlayWindow = this.getVisibleOverlayWindow()
      if (!overlayWindow) {
        this.clearResizeAnimationTimer()
        return
      }

      const now = performance.now()
      const elapsed = now - startedAt
      const progress = Math.min(1, elapsed / OVERLAY_RESIZE_DURATION_MS)
      const easedProgress =
        progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2

      overlayWindow.setBounds({
        x: Math.round(from.x + (to.x - from.x) * easedProgress),
        y: Math.round(from.y + (to.y - from.y) * easedProgress),
        width: Math.round(from.width + (to.width - from.width) * easedProgress),
        height: Math.round(from.height + (to.height - from.height) * easedProgress)
      })

      if (progress >= 1) {
        this.resizeAnimationTimer = null
        return
      }

      while (nextFrameAt <= now) {
        nextFrameAt += frameDurationMs
      }

      const delayMs = Math.max(1, nextFrameAt - now)
      this.resizeAnimationTimer = setTimeout(step, delayMs)
      this.resizeAnimationTimer.unref()
    }

    step()
  }

  private resolveAnimationFrameDurationMs(bounds: Rectangle): number {
    const center = {
      x: Math.round(bounds.x + bounds.width / 2),
      y: Math.round(bounds.y + bounds.height / 2)
    }
    const display = screen.getDisplayNearestPoint(center)
    const rawHz = Number.isFinite(display.displayFrequency) ? display.displayFrequency : 0

    if (rawHz <= 0) {
      return 1000 / OVERLAY_ANIMATION_FALLBACK_HZ
    }

    const clampedHz = Math.min(OVERLAY_ANIMATION_MAX_HZ, Math.max(OVERLAY_ANIMATION_MIN_HZ, rawHz))
    return 1000 / clampedHz
  }

  private clearResizeAnimationTimer(): void {
    if (!this.resizeAnimationTimer) {
      return
    }

    clearTimeout(this.resizeAnimationTimer)
    this.resizeAnimationTimer = null
  }

  private isCloseEnough(from: Rectangle, to: Rectangle): boolean {
    return (
      Math.abs(from.x - to.x) <= OVERLAY_LAYOUT_EPSILON_PX &&
      Math.abs(from.y - to.y) <= OVERLAY_LAYOUT_EPSILON_PX &&
      Math.abs(from.width - to.width) <= OVERLAY_LAYOUT_EPSILON_PX &&
      Math.abs(from.height - to.height) <= OVERLAY_LAYOUT_EPSILON_PX
    )
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

  private applyOverlayPerformanceMode(throttleBackground: boolean): void {
    const overlayWindow = this.getLiveOverlayWindow()
    if (!overlayWindow) {
      return
    }

    overlayWindow.webContents.setBackgroundThrottling(throttleBackground)
  }
}
