export const RECORDING_CAPTURE_COMMAND_CHANNEL = 'recording:capture-command'
export const RECORDING_CAPTURE_EVENT_CHANNEL = 'recording:capture-event'
export const RECORDING_CAPTURE_READY_CHANNEL = 'recording:capture-ready'

export const DEFAULT_RECORDING_SOUND_CUE_SETTINGS = {
  enabled: true
} as const

export const DEFAULT_RECORDING_MICROPHONE_SETTINGS = {
  selectedDeviceId: null
} as const

export type RecordingShortcutCommandType =
  | 'toggle'
  | 'cancel'
  | 'push_to_talk_start'
  | 'push_to_talk_stop'

export type RecordingMode = 'toggle' | 'push_to_talk'

export type RecordingPhase = 'idle' | 'starting' | 'recording' | 'stopping' | 'complete' | 'failed'

export type RecordingFailureReason = 'microphone_permission_denied' | 'capture_error' | 'aborted'

export type RecordingArtifactFailureReason = RecordingFailureReason | 'transcription_error'

export type RecordingOutputFormat = 'webm_opus'

export type RecordingSoundCueSettings = {
  enabled: boolean
}

export type RecordingMicrophoneSettings = {
  selectedDeviceId: string | null
}

export type RecordingCueKind = 'start' | 'cancel' | 'error' | 'auto_paste_fail'

export type RecordingPreferences = {
  soundCues: RecordingSoundCueSettings
  microphone: RecordingMicrophoneSettings
}

export type RecordingPreferencesResponse = {
  preferences: RecordingPreferences
}

export type RecordingPreferencesUpdateInput = {
  soundCues?: Partial<RecordingSoundCueSettings>
  microphone?: Partial<RecordingMicrophoneSettings>
}

export type RecordingRuntimeState = {
  phase: RecordingPhase
  mode: RecordingMode | null
  sessionId: string | null
  meterLevel: number
  activeArtifactPath: string | null
  failureReason?: RecordingFailureReason
  message?: string
}

export type RecordingCaptureStartCommand = {
  type: 'start'
  sessionId: string
  format: RecordingOutputFormat
  soundCues: RecordingSoundCueSettings
  preferredMicrophoneDeviceId: string | null
}

export type RecordingCaptureStopCommand = {
  type: 'stop'
}

export type RecordingCaptureCancelCommand = {
  type: 'cancel'
  reason: RecordingFailureReason
  soundCues: RecordingSoundCueSettings
}

export type RecordingCapturePlayCueCommand = {
  type: 'playCue'
  cue: RecordingCueKind
  soundCues: RecordingSoundCueSettings
}

export type RecordingCaptureCommand =
  | RecordingCaptureStartCommand
  | RecordingCaptureStopCommand
  | RecordingCaptureCancelCommand
  | RecordingCapturePlayCueCommand

export type RecordingCaptureChunkEvent = {
  type: 'chunk'
  sessionId: string
  chunk: Uint8Array
}

/**
 * Live audio-level visualization payload (VU/FFT bars).
 * IPC discriminator remains `meter` for protocol compatibility.
 */
export type RecordingCaptureMeterEvent = {
  type: 'meter'
  sessionId: string
  level: number
  bands: number[]
}

export type RecordingCaptureStartedEvent = {
  type: 'started'
  sessionId: string
}

export type RecordingCaptureDeviceResolvedEvent = {
  type: 'deviceResolved'
  sessionId: string
  deviceId: string | null
}

export type RecordingCaptureStoppedEvent = {
  type: 'stopped'
  sessionId: string
  durationMs: number
}

export type RecordingCaptureErrorEvent = {
  type: 'error'
  sessionId: string | null
  reason: RecordingFailureReason
  message?: string
}

export type RecordingCaptureEvent =
  | RecordingCaptureChunkEvent
  | RecordingCaptureStartedEvent
  | RecordingCaptureDeviceResolvedEvent
  | RecordingCaptureMeterEvent
  | RecordingCaptureStoppedEvent
  | RecordingCaptureErrorEvent

export type RecordingArtifact = {
  sessionId: string
  mode: RecordingMode
  format: RecordingOutputFormat
  filePath: string
  startedAt: number
  stoppedAt?: number
  durationMs?: number
}

export type RecordingFailureMetadata = RecordingArtifact & {
  failureReason: RecordingArtifactFailureReason
  failedAt: number
  message?: string
}

export type RecordingRuntimeStateResponse = {
  state: RecordingRuntimeState
}
