import type { DictationFailureReason } from '../../shared/dictation'

const COMPLETE_DISPLAY_MS = 650
const FAILURE_DISPLAY_MS = 1900
const CANCEL_DISPLAY_MS = 120

export type TerminalOutcome =
  | { type: 'complete' }
  | {
      type: 'failed'
      reason: DictationFailureReason
    }

/**
 * Resolves terminal-state display duration used before resetting to idle.
 */
export const resolveTerminalDisplayDelayMs = (outcome: TerminalOutcome): number => {
  if (outcome.type === 'complete') {
    return COMPLETE_DISPLAY_MS
  }

  return outcome.reason === 'aborted' ? CANCEL_DISPLAY_MS : FAILURE_DISPLAY_MS
}
