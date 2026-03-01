import type { RecordingShortcutCommandType } from '../../shared/recording'
import { EventBus } from '../events/event-bus'
import type { RecordingCommandEvent } from '../events/event-bus-events'

const RECORDING_COMMAND_EVENT = 'recording.command'

export type RecordingCommand = RecordingCommandEvent

type RecordingCommandListener = (command: RecordingCommand) => void

/**
 * Dedicated command channel between shortcuts and recording orchestration layers.
 */
class RecordingCommandBus {
  emit(type: RecordingShortcutCommandType): void {
    const command: RecordingCommand = {
      type,
      emittedAt: Date.now()
    }

    EventBus.emit(RECORDING_COMMAND_EVENT, command)
  }

  subscribe(listener: RecordingCommandListener): () => void {
    EventBus.on(RECORDING_COMMAND_EVENT, listener)

    return () => {
      EventBus.off(RECORDING_COMMAND_EVENT, listener)
    }
  }
}

export const recordingCommandBus = new RecordingCommandBus()
