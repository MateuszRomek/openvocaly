import type { RecordingShortcutCommandType } from '../../shared/recording'
import type { RecordingCommandBus } from '../recording/command-bus'

export type RecordingShortcutEvent = RecordingShortcutCommandType

export const createRecordingShortcutEventEmitter = (
  commandBus: Pick<RecordingCommandBus, 'emit'>
): ((event: RecordingShortcutEvent) => void) => {
  return (event: RecordingShortcutEvent): void => {
    commandBus.emit(event)
  }
}
