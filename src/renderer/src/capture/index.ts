import type { RecordingCaptureCommand } from '../../../shared/recording'
import { emitCaptureReady, onCaptureCommand } from './ipc'
import { cancelCapture, startCapture, stopCapture } from './recorder'
import { createCaptureRuntimeState } from './runtime-state'

const state = createCaptureRuntimeState()

onCaptureCommand((payload: RecordingCaptureCommand) => {
  if (payload.type === 'start') {
    void startCapture(state, payload)
    return
  }

  if (payload.type === 'stop') {
    stopCapture(state)
    return
  }

  cancelCapture(state, payload.reason, payload.soundCues)
})

emitCaptureReady()
