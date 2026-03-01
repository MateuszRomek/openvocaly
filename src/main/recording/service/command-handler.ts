import type { RecordingMode } from '../../../shared/recording'
import type { RecordingCommand } from '../command-bus'
import { canBeginRecording, canStopRecording, type RecordingMachine } from '../core/state-machine'

export type RecordingCommandIntent =
  | { type: 'ignore' }
  | { type: 'cancel' }
  | { type: 'begin'; mode: RecordingMode }
  | { type: 'stop' }

type ResolveRecordingCommandIntentInput = {
  command: RecordingCommand
  machine: RecordingMachine
  hasActiveArtifact: boolean
  isInitialized: boolean
  isMacOS: boolean
}

/**
 * Maps incoming shortcut commands to orchestration intents.
 * This module stays pure and decision-only; side effects remain in orchestrator.
 */
export const resolveRecordingCommandIntent = ({
  command,
  machine,
  hasActiveArtifact,
  isInitialized,
  isMacOS
}: ResolveRecordingCommandIntentInput): RecordingCommandIntent => {
  if (!isInitialized || !isMacOS) {
    return { type: 'ignore' }
  }

  if (command.type === 'cancel') {
    const isCancelablePhase =
      machine.phase === 'starting' || machine.phase === 'recording' || machine.phase === 'stopping'

    if (!isCancelablePhase || !hasActiveArtifact) {
      return { type: 'ignore' }
    }

    return { type: 'cancel' }
  }

  if (command.type === 'toggle') {
    if (canBeginRecording(machine)) {
      return { type: 'begin', mode: 'toggle' }
    }

    if (canStopRecording(machine)) {
      return { type: 'stop' }
    }

    return { type: 'ignore' }
  }

  if (command.type === 'push_to_talk_start') {
    if (!canBeginRecording(machine)) {
      return { type: 'ignore' }
    }

    return { type: 'begin', mode: 'push_to_talk' }
  }

  if (command.type === 'push_to_talk_stop') {
    if (machine.phase !== 'recording' || machine.mode !== 'push_to_talk') {
      return { type: 'ignore' }
    }

    return { type: 'stop' }
  }

  return { type: 'ignore' }
}
