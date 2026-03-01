import { BrowserWindow, ipcMain, type IpcMainEvent } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'node:path'
import {
  RECORDING_CAPTURE_COMMAND_CHANNEL,
  RECORDING_CAPTURE_EVENT_CHANNEL,
  RECORDING_CAPTURE_READY_CHANNEL,
  type RecordingCaptureCommand,
  type RecordingCaptureEvent
} from '../../../shared/recording'

type CaptureEventListener = (event: RecordingCaptureEvent) => void
const CAPTURE_IDLE_DESTROY_DELAY_MS = 1200

const resolveCaptureRendererTarget = (): string => {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}/capture.html`
  }

  return join(__dirname, '../renderer/capture.html')
}

/**
 * Manages hidden capture BrowserWindow lifecycle and command/event IPC bridge.
 */
export class RecordingCaptureRuntime {
  private window: BrowserWindow | null = null
  private ready = false
  private captureActive = false
  private commandQueue: RecordingCaptureCommand[] = []
  private readonly listeners = new Set<CaptureEventListener>()
  private listenersRegistered = false
  private destroyWindowTimeout: NodeJS.Timeout | null = null

  initialize(): void {
    if (this.listenersRegistered) {
      return
    }

    ipcMain.on(RECORDING_CAPTURE_READY_CHANNEL, this.handleReady)
    ipcMain.on(RECORDING_CAPTURE_EVENT_CHANNEL, this.handleCaptureEvent)
    this.listenersRegistered = true
  }

  async shutdown(): Promise<void> {
    if (this.listenersRegistered) {
      ipcMain.removeListener(RECORDING_CAPTURE_READY_CHANNEL, this.handleReady)
      ipcMain.removeListener(RECORDING_CAPTURE_EVENT_CHANNEL, this.handleCaptureEvent)
      this.listenersRegistered = false
    }

    this.commandQueue = []
    this.ready = false
    this.captureActive = false
    this.clearDestroyWindowTimeout()
    this.destroyWindow()
  }

  onEvent(listener: CaptureEventListener): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  async sendCommand(command: RecordingCaptureCommand): Promise<void> {
    this.clearDestroyWindowTimeout()

    if (command.type === 'start') {
      this.captureActive = true
      this.applyCapturePerformanceMode()
    }

    await this.ensureWindow()

    if (!this.window || this.window.isDestroyed() || !this.ready) {
      this.commandQueue.push(command)
      return
    }

    this.window.webContents.send(RECORDING_CAPTURE_COMMAND_CHANNEL, command)
  }

  private async ensureWindow(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      return
    }

    this.ready = false

    this.window = new BrowserWindow({
      width: 10,
      height: 10,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        autoplayPolicy: 'no-user-gesture-required',
        backgroundThrottling: true
      }
    })
    this.applyCapturePerformanceMode()

    this.window.on('closed', () => {
      this.window = null
      this.ready = false
      this.commandQueue = []
      this.captureActive = false
    })

    const target = resolveCaptureRendererTarget()

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      await this.window.loadURL(target)
      return
    }

    await this.window.loadFile(target)
  }

  private handleReady = (event: IpcMainEvent): void => {
    if (!this.window || event.sender.id !== this.window.webContents.id) {
      return
    }

    this.ready = true

    if (!this.commandQueue.length) {
      return
    }

    const queued = [...this.commandQueue]
    this.commandQueue = []

    for (const command of queued) {
      if (!this.window || this.window.isDestroyed()) {
        this.commandQueue.push(command)
        break
      }

      this.window.webContents.send(RECORDING_CAPTURE_COMMAND_CHANNEL, command)
    }
  }

  private handleCaptureEvent = (event: IpcMainEvent, payload: RecordingCaptureEvent): void => {
    if (!this.window || event.sender.id !== this.window.webContents.id) {
      return
    }

    for (const listener of this.listeners) {
      listener(payload)
    }

    if (payload.type === 'stopped' || payload.type === 'error') {
      this.captureActive = false
      this.applyCapturePerformanceMode()
      this.scheduleIdleDestroy()
    }
  }

  private applyCapturePerformanceMode(): void {
    if (!this.window || this.window.isDestroyed()) {
      return
    }

    this.window.webContents.setBackgroundThrottling(!this.captureActive)
  }

  private destroyWindow(): void {
    this.clearDestroyWindowTimeout()

    if (!this.window) {
      return
    }

    const closingWindow = this.window
    this.window = null
    this.ready = false
    this.commandQueue = []

    if (!closingWindow.isDestroyed()) {
      closingWindow.destroy()
    }
  }

  private scheduleIdleDestroy(): void {
    this.clearDestroyWindowTimeout()
    this.destroyWindowTimeout = setTimeout(() => {
      this.destroyWindowTimeout = null
      this.destroyWindow()
    }, CAPTURE_IDLE_DESTROY_DELAY_MS)
    this.destroyWindowTimeout.unref()
  }

  private clearDestroyWindowTimeout(): void {
    if (!this.destroyWindowTimeout) {
      return
    }

    clearTimeout(this.destroyWindowTimeout)
    this.destroyWindowTimeout = null
  }
}
