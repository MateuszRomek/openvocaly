import { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'node:path'
import { isMacOS } from '../../helpers/platform'
import { OVERLAY_HEIGHT, OVERLAY_WIDTH } from './positioning'

export const resolveOverlayRendererTarget = (): string => {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}/overlay.html`
  }

  return join(__dirname, '../renderer/overlay.html')
}

export const createOverlayWindow = (): BrowserWindow =>
  new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: isMacOS(),
    roundedCorners: true,
    acceptFirstMouse: false,
    alwaysOnTop: true,
    ...(isMacOS() ? { type: 'panel' as const } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: true,
      devTools: is.dev
    }
  })

export const loadOverlayWindow = async (overlayWindow: BrowserWindow): Promise<void> => {
  const target = resolveOverlayRendererTarget()

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await overlayWindow.loadURL(target)
  } else {
    await overlayWindow.loadFile(target)
  }
}
