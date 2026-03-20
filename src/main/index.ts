import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  nativeImage,
  nativeTheme,
  powerMonitor
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import appIconIco from '../../build/icon.ico?asset'
import appIconBackgroundDarkPng from '../../resources/app-icons/openvocaly-app-icon-background-dark-512.png?asset'
import appIconBackgroundLightPng from '../../resources/app-icons/openvocaly-app-icon-background-light-512.png?asset'
import { createMainAppContext } from './app-context'
import { closeDb } from './db'
import { withShutdownTimeout } from './helpers/lifecycle'
import { createLogger } from './helpers/logger'
import { isMacOS, isWindows } from './helpers/platform'

const GRACEFUL_QUIT_TIMEOUT_MS = 2500
const PASTE_WARMUP_DELAY_MS = 8_000
const logger = createLogger('main.index')
const appWindowIcon = isWindows() ? appIconIco : appIconBackgroundDarkPng
const MAC_DOCK_ICON_INSET_RATIO = 0.1

const mainContext = createMainAppContext()

let mainWindow: BrowserWindow | null = null
let hasShutdownCompleted = false
let shutdownPromise: Promise<void> | null = null
let isQuitting = false
let pasteWarmupCompleted = false
let pasteWarmupOnAcListener: (() => void) | null = null
const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
}

const runStep = async (label: string, operation: () => Promise<void> | void): Promise<void> => {
  try {
    await operation()
  } catch (error) {
    console.error(`[main] ${label}`, error)
  }
}

const createInsetMacDockIcon = (iconPath: string): Electron.NativeImage => {
  const baseIcon = nativeImage.createFromPath(iconPath)
  if (baseIcon.isEmpty()) {
    return baseIcon
  }

  const { width, height } = baseIcon.getSize()
  if (width <= 0 || height <= 0) {
    return baseIcon
  }

  const insetX = Math.round(width * MAC_DOCK_ICON_INSET_RATIO)
  const insetY = Math.round(height * MAC_DOCK_ICON_INSET_RATIO)
  const targetWidth = Math.max(1, width - insetX * 2)
  const targetHeight = Math.max(1, height - insetY * 2)
  const scaledIcon = baseIcon.resize({ width: targetWidth, height: targetHeight, quality: 'best' })
  const scaledSize = scaledIcon.getSize()
  const scaledBitmap = scaledIcon.toBitmap()

  const bytesPerPixel = 4
  const sourceStride = scaledSize.width * bytesPerPixel
  const destinationStride = width * bytesPerPixel
  const destinationBuffer = Buffer.alloc(width * height * bytesPerPixel, 0)
  const offsetX = Math.floor((width - scaledSize.width) / 2)
  const offsetY = Math.floor((height - scaledSize.height) / 2)

  for (let row = 0; row < scaledSize.height; row += 1) {
    const sourceStart = row * sourceStride
    const destinationStart = (offsetY + row) * destinationStride + offsetX * bytesPerPixel
    scaledBitmap.copy(destinationBuffer, destinationStart, sourceStart, sourceStart + sourceStride)
  }

  return nativeImage.createFromBitmap(destinationBuffer, {
    width,
    height,
    scaleFactor: 1
  })
}

const getMacDockIcon = (): Electron.NativeImage => {
  const iconPath = nativeTheme.shouldUseDarkColors
    ? appIconBackgroundLightPng
    : appIconBackgroundDarkPng
  return createInsetMacDockIcon(iconPath)
}

const applyMacDockIcon = (): void => {
  if (!isMacOS()) {
    return
  }

  app.dock?.setIcon(getMacDockIcon())
}

const clearPasteWarmupOnAcListener = (): void => {
  if (!pasteWarmupOnAcListener) {
    return
  }

  powerMonitor.off('on-ac', pasteWarmupOnAcListener)
  pasteWarmupOnAcListener = null
}

const isThermalStateSafeForWarmup = (): boolean => {
  if (!isMacOS()) {
    return true
  }

  try {
    const thermalState = powerMonitor.getCurrentThermalState()
    return thermalState !== 'serious' && thermalState !== 'critical'
  } catch {
    return true
  }
}

const isOnBatteryPowerSafe = (): boolean => {
  try {
    return powerMonitor.isOnBatteryPower()
  } catch {
    return false
  }
}

const ensurePasteWarmupOnAcListener = (): void => {
  if (pasteWarmupOnAcListener) {
    return
  }

  pasteWarmupOnAcListener = () => {
    void tryRunPasteWarmup('on_ac')
  }

  powerMonitor.on('on-ac', pasteWarmupOnAcListener)
}

const tryRunPasteWarmup = async (source: 'startup_delay' | 'on_ac'): Promise<void> => {
  if (pasteWarmupCompleted) {
    return
  }

  if (!isMacOS()) {
    return
  }

  if (!mainContext.services.permissionsService.isAccessibilityGranted()) {
    logger.debug({
      source,
      reason: 'accessibility_not_granted',
      event: 'paste_warmup_skipped'
    })
    clearPasteWarmupOnAcListener()
    return
  }

  if (!isThermalStateSafeForWarmup()) {
    logger.debug({
      source,
      reason: 'thermal_state_unhealthy',
      event: 'paste_warmup_skipped'
    })
    return
  }

  if (isOnBatteryPowerSafe()) {
    logger.debug({
      source,
      reason: 'on_battery_power',
      event: 'paste_warmup_deferred'
    })
    ensurePasteWarmupOnAcListener()
    return
  }

  const startedAt = Date.now()

  try {
    await mainContext.services.pasteService.prewarm()
    pasteWarmupCompleted = true
    clearPasteWarmupOnAcListener()
    logger.debug({
      source,
      elapsedMs: Date.now() - startedAt,
      event: 'paste_warmup_complete'
    })
  } catch (error) {
    logger.debug({
      source,
      message: error instanceof Error ? error.message : 'Paste warmup failed unexpectedly.',
      event: 'paste_warmup_failed'
    })
  }
}

const performShutdownSequence = (): Promise<void> => {
  if (hasShutdownCompleted) {
    return Promise.resolve()
  }

  if (shutdownPromise) {
    return shutdownPromise
  }

  shutdownPromise = (async () => {
    await runStep('pipeline teardown failed', () => mainContext.ipc.pipelineIpc.shutdown())
    await runStep('recording teardown failed', () =>
      withShutdownTimeout(() => mainContext.ipc.recordingIpc.shutdown(), GRACEFUL_QUIT_TIMEOUT_MS)
    )
    await runStep('transcription teardown failed', () =>
      mainContext.ipc.transcriptionIpc.shutdown()
    )
    await runStep('shortcuts teardown failed', () => mainContext.ipc.shortcutsIpc.shutdown())
    await runStep('database teardown failed', () => closeDb())

    hasShutdownCompleted = true
  })()

  return shutdownPromise
}

function createWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }
    mainWindow.focus()
    return
  }

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    minWidth: 768,
    minHeight: 550,
    show: false,
    autoHideMenuBar: true,
    title: 'OpenVocaly',
    icon: appWindowIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: true,
      devTools: is.dev
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.on('close', (event) => {
    if (!isMacOS() || isQuitting || is.dev) {
      return
    }

    event.preventDefault()
    mainWindow?.hide()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) {
    return
  }

  app.setName('OpenVocaly')
  applyMacDockIcon()
  nativeTheme.on('updated', applyMacDockIcon)

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.openvocally.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
    window.on('focus', () => {
      void runStep('shortcuts failed to repair on window focus', () =>
        mainContext.services.shortcutService.repairSupportedGlobalRegistrations({
          source: 'window_focus'
        })
      )
    })
  })

  // IPC test
  ipcMain.on('ping', () => logger.debug('pong'))

  await runStep('database failed to initialize', () =>
    mainContext.repositories.databaseLifecycle.initialize()
  )

  mainContext.ipc.storageIpc.registerIpcHandlers()
  mainContext.ipc.onboardingIpc.registerIpcHandlers()
  mainContext.ipc.permissionsIpc.registerIpcHandlers()
  mainContext.ipc.shortcutsIpc.registerIpcHandlers()
  mainContext.ipc.recordingIpc.registerIpcHandlers()
  mainContext.ipc.transcriptionIpc.registerIpcHandlers()
  mainContext.ipc.reportingIpc.registerIpcHandlers()
  mainContext.ipc.pipelineIpc.registerIpcHandlers()
  await runStep('onboarding failed to initialize onboarding subsystem', () =>
    mainContext.ipc.onboardingIpc.initialize()
  )
  await runStep('shortcuts failed to initialize shortcuts subsystem', () =>
    mainContext.ipc.shortcutsIpc.initialize()
  )

  await runStep('transcription failed to initialize transcription subsystem', () =>
    mainContext.ipc.transcriptionIpc.initialize()
  )
  await runStep('recording failed to initialize recording subsystem', () =>
    mainContext.ipc.recordingIpc.initialize()
  )
  await runStep('pipeline failed to initialize dictation pipeline', () =>
    mainContext.ipc.pipelineIpc.initialize()
  )

  createWindow()

  void runStep('pipeline failed to prewarm overlay', () =>
    mainContext.services.pipelineOrchestrator.prewarm()
  )

  const pasteWarmupTimer = setTimeout(() => {
    void tryRunPasteWarmup('startup_delay')
  }, PASTE_WARMUP_DELAY_MS)
  pasteWarmupTimer.unref()

  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow()
      return
    }

    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.focus()
  })

  app.on('activate', function () {
    void runStep('shortcuts failed to repair on activate', () =>
      mainContext.services.shortcutService.repairSupportedGlobalRegistrations({
        source: 'activate'
      })
    )

    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow()
      return
    }

    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }

    mainWindow.focus()
  })

  powerMonitor.on('resume', () => {
    void runStep('shortcuts failed to repair on resume', () =>
      mainContext.services.shortcutService.repairSupportedGlobalRegistrations({
        source: 'resume'
      })
    )
  })
})

// Quit when all windows are closed.
// In production on macOS, keep the app active (standard behavior).
// In development, quit to avoid a docked app bound to a dead dev server.
app.on('window-all-closed', () => {
  if (!isMacOS() || is.dev) {
    app.quit()
  }
})

app.on('before-quit', (event) => {
  if (hasShutdownCompleted) {
    isQuitting = true
    return
  }

  if (isMacOS()) {
    nativeTheme.removeListener('updated', applyMacDockIcon)
    clearPasteWarmupOnAcListener()
    app.dock?.hide()
  }

  event.preventDefault()

  void performShutdownSequence().finally(() => {
    isQuitting = true
    app.quit()
  })
})

// In development, ensure Ctrl+C / dev server stop terminates Electron cleanly.
if (is.dev) {
  if (isWindows()) {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
    process.on('SIGINT', () => {
      app.quit()
    })
  }
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
