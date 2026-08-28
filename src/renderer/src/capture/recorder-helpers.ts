import {
  DEFAULT_RECORDING_SOUND_CUE_SETTINGS,
  normalizeRecordingSoundCueVolume,
  type RecordingFailureReason,
  type RecordingSoundCueSettings
} from '../../../shared/recording'

export type CaptureStartFailure = {
  reason: RecordingFailureReason
  message: string
}

export const resolveCaptureSoundCueSettings = (
  input: RecordingSoundCueSettings | undefined
): RecordingSoundCueSettings => ({
  enabled: input?.enabled ?? DEFAULT_RECORDING_SOUND_CUE_SETTINGS.enabled,
  volume: normalizeRecordingSoundCueVolume(
    input?.volume,
    DEFAULT_RECORDING_SOUND_CUE_SETTINGS.volume
  )
})

export const resolveSupportedCaptureMimeType = (): string | null => {
  const preferredType = 'audio/webm;codecs=opus'

  if (MediaRecorder.isTypeSupported(preferredType)) {
    return preferredType
  }

  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'audio/webm'
  }

  return null
}

export const toCanceledRecordingMessage = (reason: RecordingFailureReason): string | undefined =>
  reason === 'aborted' ? 'Recording was cancelled.' : undefined

/**
 * Maps `getUserMedia` start failures into capture protocol failure reasons/messages.
 */
export const toCaptureStartFailure = (error: unknown): CaptureStartFailure => {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return {
      reason: 'microphone_permission_denied',
      message: 'Microphone permission is denied.'
    }
  }

  return {
    reason: 'capture_error',
    message: error instanceof Error ? error.message : 'Failed to start audio capture.'
  }
}
