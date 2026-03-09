import type { RecordingArtifact } from '../../shared/recording'
import { createDomainBus } from '../events/domain-bus'

const RECORDING_ARTIFACT_READY_EVENT = 'recording.artifact-ready'

type RecordingArtifactReadyListener = (artifact: RecordingArtifact) => void

const artifactReadyDomainBus = createDomainBus(RECORDING_ARTIFACT_READY_EVENT, {
  toEvent: (artifact: RecordingArtifact) => ({
    artifact,
    emittedAt: Date.now()
  }),
  fromEvent: (event: { artifact: RecordingArtifact }): RecordingArtifact => event.artifact
})

export class RecordingArtifactBus {
  emit(artifact: RecordingArtifact): void {
    artifactReadyDomainBus.emit(artifact)
  }

  subscribe(listener: RecordingArtifactReadyListener): () => void {
    return artifactReadyDomainBus.subscribe(listener)
  }
}
