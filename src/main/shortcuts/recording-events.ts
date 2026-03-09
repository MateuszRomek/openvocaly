import type { RecordingShortcutCommandType } from '../../shared/recording'
import type { RecordingCommandBus } from '../recording/command-bus'

export type RecordingShortcutEvent = RecordingShortcutCommandType

export const createRecordingShortcutEventEmitter = (
  commandBus: RecordingCommandBus
): ((event: RecordingShortcutEvent) => void) => {
  return (event: RecordingShortcutEvent): void => {
    commandBus.emit(event)
  }
}
