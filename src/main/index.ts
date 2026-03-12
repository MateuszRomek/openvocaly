import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createMainAppContext } from './app-context'
import { closeDb } from './db'
import { withShutdownTimeout } from './helpers/lifecycle'
import { createLogger } from './helpers/logger'
import { isLinux, isMacOS, isWindows } from './helpers/platform'

const GRACEFUL_QUIT_TIMEOUT_MS = 2500
const logger = createLogger('main.index')

const mainContext = createMainAppContext()

let mainWindow: BrowserWindow | null = null
let hasShutdownCompleted = false
let shutdownPromise: Promise<void> | null = null
let isQuitting = false
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
    ...(isLinux() ? { icon } : {}),
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

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.openvocally.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => logger.debug('pong'))

  await runStep('database failed to initialize', () =>
    mainContext.repositories.databaseLifecycle.initialize()
  )

  mainContext.ipc.storageIpc.registerIpcHandlers()
  mainContext.ipc.permissionsIpc.registerIpcHandlers()
  mainContext.ipc.shortcutsIpc.registerIpcHandlers()
  mainContext.ipc.recordingIpc.registerIpcHandlers()
  mainContext.ipc.transcriptionIpc.registerIpcHandlers()
  mainContext.ipc.reportingIpc.registerIpcHandlers()
  mainContext.ipc.pipelineIpc.registerIpcHandlers()
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
