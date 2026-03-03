import type { RecordingSessionSnapshot } from './service/session'

type RecordingSessionListener = (snapshot: RecordingSessionSnapshot) => void

class RecordingSessionBus {
  private listeners = new Set<RecordingSessionListener>()

  emit(snapshot: RecordingSessionSnapshot): void {
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }

  subscribe(listener: RecordingSessionListener): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }
}

export const recordingSessionBus = new RecordingSessionBus()
