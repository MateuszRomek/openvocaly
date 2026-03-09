import type { RecordingShortcutCommandType } from '../../shared/recording'
import { createDomainBus } from '../events/domain-bus'
import type { RecordingCommandEvent } from '../events/event-bus-events'

const RECORDING_COMMAND_EVENT = 'recording.command'

export type RecordingCommand = RecordingCommandEvent

type RecordingCommandListener = (command: RecordingCommand) => void

const recordingCommandDomainBus = createDomainBus(RECORDING_COMMAND_EVENT, {
  toEvent: (command: RecordingCommand): RecordingCommand => command,
  fromEvent: (event: RecordingCommand): RecordingCommand => event
})

/**
 * Dedicated command channel between shortcuts and recording orchestration layers.
 */
export class RecordingCommandBus {
  emit(type: RecordingShortcutCommandType): void {
    const command: RecordingCommand = {
      type,
      emittedAt: Date.now()
    }

    recordingCommandDomainBus.emit(command)
  }

  subscribe(listener: RecordingCommandListener): () => void {
    return recordingCommandDomainBus.subscribe(listener)
  }
}
