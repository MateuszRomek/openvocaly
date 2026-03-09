import type { RecordingFailureReason, RecordingMode, RecordingPhase } from './recording'

export const DICTATION_OVERLAY_STATE_CHANNEL = 'dictation:overlay-state'

export type DictationPhase = RecordingPhase | 'transcribing' | 'awaiting_manual_paste'

export type DictationFailureReason =
  | RecordingFailureReason
  | 'transcription_error'
  | 'paste_not_supported'
  | 'paste_permission_denied'
  | 'paste_runtime_error'

export type DictationManualPasteState = {
  remainingMs: number
  timeoutMs: number
  hint: string
}

export type DictationRuntimeState = {
  phase: DictationPhase
  mode: RecordingMode | null
  sessionId: string | null
  meterLevel: number
  failureReason?: DictationFailureReason
  message?: string
  manualPaste?: DictationManualPasteState
}

export type DictationRuntimeStateResponse = {
  state: DictationRuntimeState
}

export type DictationOverlayState = {
  phase: Exclude<DictationPhase, 'idle'>
  mode: RecordingMode | null
  meterLevel: number
  bands: number[]
  failureReason?: DictationFailureReason
  message?: string
  manualPaste?: DictationManualPasteState
}
