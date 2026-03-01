import {
  RECORDING_CAPTURE_COMMAND_CHANNEL,
  RECORDING_CAPTURE_EVENT_CHANNEL,
  RECORDING_CAPTURE_READY_CHANNEL,
  type RecordingCaptureCommand,
  type RecordingFailureReason
} from '../../../shared/recording'

const ipc = window.electron.ipcRenderer

export const emitCaptureReady = (): void => {
  ipc.send(RECORDING_CAPTURE_READY_CHANNEL)
}

export const emitCaptureChunk = (sessionId: string, chunk: Uint8Array): void => {
  ipc.send(RECORDING_CAPTURE_EVENT_CHANNEL, {
    type: 'chunk',
    sessionId,
    chunk
  })
}

export const emitCaptureMeter = (sessionId: string, level: number, bands: number[]): void => {
  ipc.send(RECORDING_CAPTURE_EVENT_CHANNEL, {
    type: 'meter',
    sessionId,
    level,
    bands
  })
}

export const emitCaptureStopped = (sessionId: string | null, durationMs: number): void => {
  ipc.send(RECORDING_CAPTURE_EVENT_CHANNEL, {
    type: 'stopped',
    sessionId,
    durationMs
  })
}

export const emitCaptureError = (
  sessionId: string | null,
  reason: RecordingFailureReason,
  message?: string
): void => {
  ipc.send(RECORDING_CAPTURE_EVENT_CHANNEL, {
    type: 'error',
    sessionId,
    reason,
    message
  })
}

export const onCaptureCommand = (listener: (command: RecordingCaptureCommand) => void): void => {
  ipc.on(RECORDING_CAPTURE_COMMAND_CHANNEL, (_event, payload: RecordingCaptureCommand) => {
    listener(payload)
  })
}
