import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { closeDb } from './db'
import { isLinux, isMacOS, isWindows } from './helpers/platform'
import { dictationPipelineOrchestrator } from './pipeline/dictation-pipeline-orchestrator'
import { registerPermissionsIpc } from './permissions/ipc'
import { initializeRecording, registerRecordingIpc, shutdownRecording } from './recording/ipc'
import { initializeShortcuts, registerShortcutsIpc, shutdownShortcuts } from './shortcuts/ipc'
import { registerStorageIpc } from './storage'
import {
  initializeTranscription,
  registerTranscriptionIpc,
  shutdownTranscription
} from './transcription/ipc'

const GRACEFUL_QUIT_TIMEOUT_MS = 2500

let mainWindow: BrowserWindow | null = null
let hasShutdownCompleted = false
let shutdownPromise: Promise<void> | null = null
let isQuitting = false

const createTimeout = (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, delayMs)
    timer.unref()
  })

const performShutdownSequence = (): Promise<void> => {
  if (hasShutdownCompleted) {
    return Promise.resolve()
  }

  if (shutdownPromise) {
    return shutdownPromise
  }

  shutdownPromise = (async () => {
    try {
      await dictationPipelineOrchestrator.shutdown()
    } catch (error) {
      console.error('[shutdown] pipeline teardown failed', error)
    }

    try {
      await Promise.race([shutdownRecording(), createTimeout(GRACEFUL_QUIT_TIMEOUT_MS)])
    } catch (error) {
      console.error('[shutdown] recording teardown failed', error)
    }

    try {
      await shutdownTranscription()
    } catch (error) {
      console.error('[shutdown] transcription teardown failed', error)
    }

    try {
      shutdownShortcuts()
    } catch (error) {
      console.error('[shutdown] shortcuts teardown failed', error)
    }

    try {
      closeDb()
    } catch (error) {
      console.error('[shutdown] database teardown failed', error)
    }

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
    title: 'OpenVocally',
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
  app.setName('OpenVocally')

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.openvocally.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  registerStorageIpc()
  registerPermissionsIpc()
  registerShortcutsIpc()
  registerRecordingIpc()
  registerTranscriptionIpc()
  initializeShortcuts()

  try {
    await initializeTranscription()
  } catch (error) {
    console.error('[transcription] failed to initialize transcription subsystem', error)
  }

  try {
    await initializeRecording()
  } catch (error) {
    console.error('[recording] failed to initialize recording subsystem', error)
  }

  try {
    await dictationPipelineOrchestrator.initialize()
  } catch (error) {
    console.error('[pipeline] failed to initialize dictation pipeline', error)
  }

  createWindow()

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
