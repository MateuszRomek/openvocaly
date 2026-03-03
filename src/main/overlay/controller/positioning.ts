import { screen, type BrowserWindow, type Rectangle } from 'electron'
import type { DictationOverlayState } from '../../../shared/dictation'
import {
  resolveOverlayWindowSize,
  type OverlayWindowSize
} from '../../../shared/overlay-presentation'

export const OVERLAY_WIDTH = 170
export const OVERLAY_HEIGHT = 40
const OVERLAY_BOTTOM_PADDING = 24
export const OVERLAY_FOLLOW_FAST_INTERVAL_MS = 110
export const OVERLAY_FOLLOW_SLOW_INTERVAL_MS = 320
export const OVERLAY_FOLLOW_STABLE_TICKS_FOR_SLOW = 8

const DEFAULT_OVERLAY_SIZE: OverlayWindowSize = {
  width: OVERLAY_WIDTH,
  height: OVERLAY_HEIGHT
}

const resolveOverlayBounds = (size: OverlayWindowSize): Rectangle => {
  const pointer = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(pointer)
  const { x, y, width, height } = display.workArea

  const targetX = Math.round(x + width / 2 - size.width / 2)
  const targetY = Math.round(y + height - size.height - OVERLAY_BOTTOM_PADDING)

  return {
    x: targetX,
    y: targetY,
    width: size.width,
    height: size.height
  }
}

export const resolveOverlaySizeForState = (
  state: Pick<DictationOverlayState, 'phase' | 'failureReason' | 'message'> | null
): OverlayWindowSize => resolveOverlayWindowSize(state, DEFAULT_OVERLAY_SIZE)

export const resolveOverlayBoundsOnActiveDisplay = (
  size: OverlayWindowSize = DEFAULT_OVERLAY_SIZE
): Rectangle => resolveOverlayBounds(size)

export const positionOverlayOnActiveDisplay = (
  overlayWindow: BrowserWindow,
  size: OverlayWindowSize = DEFAULT_OVERLAY_SIZE
): void => {
  if (overlayWindow.isDestroyed()) {
    return
  }

  overlayWindow.setBounds(resolveOverlayBounds(size))
}
