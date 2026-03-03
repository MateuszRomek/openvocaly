import type { RecordingArtifact } from '../../shared/recording'
import { EventBus } from '../events/event-bus'

const RECORDING_ARTIFACT_READY_EVENT = 'recording.artifact-ready'

type RecordingArtifactReadyListener = (artifact: RecordingArtifact) => void

class RecordingArtifactBus {
  emit(artifact: RecordingArtifact): void {
    EventBus.emit(RECORDING_ARTIFACT_READY_EVENT, {
      artifact,
      emittedAt: Date.now()
    })
  }

  subscribe(listener: RecordingArtifactReadyListener): () => void {
    const wrapped = (event: { artifact: RecordingArtifact }): void => {
      listener(event.artifact)
    }

    EventBus.on(RECORDING_ARTIFACT_READY_EVENT, wrapped)

    return () => {
      EventBus.off(RECORDING_ARTIFACT_READY_EVENT, wrapped)
    }
  }
}

export const recordingArtifactBus = new RecordingArtifactBus()
