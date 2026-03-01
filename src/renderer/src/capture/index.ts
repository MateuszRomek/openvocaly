import type { RecordingCaptureCommand } from '../../../shared/recording'
import { emitCaptureReady, onCaptureCommand } from './ipc'
import { primeRecordingCueOutput } from './audio-cues'
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

void primeRecordingCueOutput().catch((error) => {
  console.error('[recording] failed to prime cue output', error)
})
