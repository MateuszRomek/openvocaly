import type { RecordingShortcutCommandType } from '../../shared/recording'
import { recordingCommandBus } from '../recording/command-bus'

export type RecordingShortcutEvent = RecordingShortcutCommandType

export const emitRecordingShortcutEvent = (event: RecordingShortcutEvent): void => {
  recordingCommandBus.emit(event)
}
