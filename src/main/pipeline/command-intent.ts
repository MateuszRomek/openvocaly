import type { DictationPhase } from '../../shared/dictation'
import { isActiveCapturePhase, isIdlePhase } from '../../shared/lifecycle'
import type { RecordingMode } from '../../shared/recording'
import type { RecordingCommand } from '../recording/command-bus'

export type DictationCommandContext = {
  phase: DictationPhase
  mode: RecordingMode | null
}

export type DictationCommandIntent =
  | { type: 'ignore' }
  | { type: 'cancel' }
  | { type: 'cancel_transcription' }
  | { type: 'cancel_manual_paste' }
  | { type: 'start'; mode: RecordingMode }
  | { type: 'stop' }

/**
 * Maps incoming shortcut command + current dictation context to a single
 * executable intent. Keeps command-policy decisions pure and testable.
 */
export const resolveDictationCommandIntent = (
  context: DictationCommandContext,
  command: RecordingCommand
): DictationCommandIntent => {
  const isModePhase = (phase: 'starting' | 'recording', mode: RecordingMode): boolean =>
    context.phase === phase && context.mode === mode

  if (command.type === 'cancel') {
    if (context.phase === 'transcribing') {
      return { type: 'cancel_transcription' }
    }

    if (context.phase === 'awaiting_manual_paste') {
      return { type: 'cancel_manual_paste' }
    }

    if (!isActiveCapturePhase(context.phase)) {
      return { type: 'ignore' }
    }

    return { type: 'cancel' }
  }

  if (command.type === 'toggle') {
    if (isIdlePhase(context.phase)) {
      return { type: 'start', mode: 'toggle' }
    }

    if (isModePhase('starting', 'toggle')) {
      return { type: 'cancel' }
    }

    if (isModePhase('recording', 'toggle')) {
      return { type: 'stop' }
    }

    return { type: 'ignore' }
  }

  if (command.type === 'push_to_talk_start') {
    if (!isIdlePhase(context.phase)) {
      return { type: 'ignore' }
    }

    return { type: 'start', mode: 'push_to_talk' }
  }

  if (command.type === 'push_to_talk_stop') {
    if (isModePhase('starting', 'push_to_talk')) {
      return { type: 'cancel' }
    }

    if (isModePhase('recording', 'push_to_talk')) {
      return { type: 'stop' }
    }

    return { type: 'ignore' }
  }

  return { type: 'ignore' }
}
