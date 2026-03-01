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
import { drainCaptureCommandQueue } from './command-queue'

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
 *
 * Ready handshake semantics:
 * - Renderer emits `RECORDING_CAPTURE_READY_CHANNEL` after IPC listeners mount.
 * - Commands sent before readiness are queued.
 * - Queue replay is deterministic (FIFO) once ready arrives.
 * - If the window disappears during replay, unsent suffix stays queued for next ready.
 *
 * Idle destroy policy:
 * - After `stopped`/`error`, window is torn down after CAPTURE_IDLE_DESTROY_DELAY_MS.
 * - Pending timers are unref-ed so they do not block app shutdown.
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
      this.captureActive = false
    })

    const target = resolveCaptureRendererTarget()

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      await this.window.loadURL(target)
      return
    }

    await this.window.loadFile(target)
  }

  /**
   * Capture renderer ready signal.
   * Replays queued commands in order and preserves unsent tail if replay halts.
   */
  private handleReady = (event: IpcMainEvent): void => {
    if (!this.window || event.sender.id !== this.window.webContents.id) {
      return
    }

    this.ready = true

    if (!this.commandQueue.length) {
      return
    }

    const drainResult = drainCaptureCommandQueue(this.commandQueue, (command) => {
      const liveWindow = this.window
      if (!liveWindow || liveWindow.isDestroyed()) {
        return 'halt'
      }

      try {
        liveWindow.webContents.send(RECORDING_CAPTURE_COMMAND_CHANNEL, command)
        return 'sent'
      } catch {
        return 'halt'
      }
    })

    this.commandQueue = drainResult.remaining
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
