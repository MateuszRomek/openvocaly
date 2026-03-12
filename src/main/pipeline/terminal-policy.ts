import type { DictationFailureReason } from '../../shared/dictation'

const COMPLETE_DISPLAY_MS = 650
const FAILURE_DISPLAY_MS = 1900
const FAILURE_WITH_MESSAGE_DISPLAY_MS = 2900
const CANCEL_DISPLAY_MS = 120
const PASTE_LAST_ERROR_DISPLAY_MS = 1_100

export type TerminalOutcome =
  | { type: 'complete' }
  | {
      type: 'failed'
      reason: DictationFailureReason
      hasMessage: boolean
    }

/**
 * Resolves terminal-state display duration used before resetting to idle.
 */
export const resolveTerminalDisplayDelayMs = (outcome: TerminalOutcome): number => {
  if (outcome.type === 'complete') {
    return COMPLETE_DISPLAY_MS
  }

  if (outcome.reason === 'aborted') {
    return CANCEL_DISPLAY_MS
  }

  return outcome.hasMessage ? FAILURE_WITH_MESSAGE_DISPLAY_MS : FAILURE_DISPLAY_MS
}

export const resolvePasteLastErrorDisplayDelayMs = (): number => PASTE_LAST_ERROR_DISPLAY_MS
