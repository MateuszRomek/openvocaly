import type { RecordingSessionSnapshot } from './service/session'
import { createDomainBus } from '../events/domain-bus'

type RecordingSessionListener = (snapshot: RecordingSessionSnapshot) => void

const RECORDING_SESSION_EVENT = 'recording.session'

const recordingSessionDomainBus = createDomainBus(RECORDING_SESSION_EVENT, {
  toEvent: (snapshot: RecordingSessionSnapshot) => ({
    snapshot,
    emittedAt: Date.now()
  }),
  fromEvent: (event: { snapshot: RecordingSessionSnapshot }): RecordingSessionSnapshot =>
    event.snapshot
})

class RecordingSessionBus {
  emit(snapshot: RecordingSessionSnapshot): void {
    recordingSessionDomainBus.emit(snapshot)
  }

  subscribe(listener: RecordingSessionListener): () => void {
    return recordingSessionDomainBus.subscribe(listener)
  }
}

export { RecordingSessionBus }
