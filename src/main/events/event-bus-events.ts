import type { RecordingArtifact, RecordingShortcutCommandType } from '../../shared/recording'
import type { RecordingSessionSnapshot } from '../recording/service/session'

export type RecordingCommandEvent = {
  type: RecordingShortcutCommandType
  emittedAt: number
}

export type EventBusEvents = {
  'recording.command': RecordingCommandEvent
  'recording.artifact-ready': {
    artifact: RecordingArtifact
    emittedAt: number
  }
  'recording.session': {
    snapshot: RecordingSessionSnapshot
    emittedAt: number
  }
}
