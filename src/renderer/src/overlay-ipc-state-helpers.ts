import type { DictationOverlayState } from '../../shared/dictation'
import { isSameNullableObjectByKeys } from '@renderer/lib/object-match'

export type ManualPasteOverlayState = DictationOverlayState['manualPaste'] | null

const MANUAL_PASTE_STATE_KEYS = ['hint', 'timeoutMs', 'remainingMs'] as const

export const toManualPasteOverlayState = (state: DictationOverlayState): ManualPasteOverlayState =>
  state.phase === 'awaiting_manual_paste' && state.manualPaste ? state.manualPaste : null

export const isSameManualPasteOverlayState = (
  left: ManualPasteOverlayState,
  right: ManualPasteOverlayState
): boolean => isSameNullableObjectByKeys(left, right, MANUAL_PASTE_STATE_KEYS)
