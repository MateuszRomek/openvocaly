import type { RecordingShortcutCommandType } from '../../shared/recording'

export type RecordingCommandEvent = {
  type: RecordingShortcutCommandType
  emittedAt: number
}

export type EventBusEvents = {
  'recording.command': RecordingCommandEvent
}
