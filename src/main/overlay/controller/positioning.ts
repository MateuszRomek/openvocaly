import { screen, type BrowserWindow } from 'electron'

export const OVERLAY_WIDTH = 208
export const OVERLAY_HEIGHT = 44
const OVERLAY_BOTTOM_PADDING = 36
export const OVERLAY_FOLLOW_FAST_INTERVAL_MS = 110
export const OVERLAY_FOLLOW_SLOW_INTERVAL_MS = 320
export const OVERLAY_FOLLOW_STABLE_TICKS_FOR_SLOW = 8

export const positionOverlayOnActiveDisplay = (overlayWindow: BrowserWindow): void => {
  if (overlayWindow.isDestroyed()) {
    return
  }

  const pointer = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(pointer)
  const { x, y, width, height } = display.workArea

  const targetX = Math.round(x + width / 2 - OVERLAY_WIDTH / 2)
  const targetY = Math.round(y + height - OVERLAY_HEIGHT - OVERLAY_BOTTOM_PADDING)

  overlayWindow.setBounds({
    x: targetX,
    y: targetY,
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT
  })
}
