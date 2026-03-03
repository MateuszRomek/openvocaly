import type { RecordingFailureReason, RecordingMode, RecordingPhase } from './recording'

export const DICTATION_OVERLAY_STATE_CHANNEL = 'dictation:overlay-state'

export type DictationPhase = RecordingPhase | 'transcribing'

export type DictationFailureReason = RecordingFailureReason | 'transcription_error'

export type DictationRuntimeState = {
  phase: DictationPhase
  mode: RecordingMode | null
  sessionId: string | null
  meterLevel: number
  failureReason?: DictationFailureReason
  message?: string
}

export type DictationRuntimeStateResponse = {
  state: DictationRuntimeState
}

export type DictationOverlayState = {
  phase: Exclude<DictationPhase, 'idle'>
  mode: RecordingMode | null
  meterLevel: number
  bands: number[]
  message?: string
}
