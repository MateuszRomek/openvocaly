import type { RecordingArtifact, RecordingShortcutCommandType } from '../../shared/recording'

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
}
