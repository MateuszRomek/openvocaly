import type { RecordingFailureReason } from '../../../shared/recording'

type CaptureRuntimeOperation = 'start' | 'stop' | 'cancel'

export type RecordingFailureDescriptor = {
  reason: RecordingFailureReason
  message?: string
}

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

export const toArtifactCreationFailure = (error: unknown): RecordingFailureDescriptor => ({
  reason: 'capture_error',
  message: toErrorMessage(error, 'Failed to create recording artifact.')
})

export const toChunkWriteFailure = (error: unknown): RecordingFailureDescriptor => ({
  reason: 'capture_error',
  message: toErrorMessage(error, 'Failed to write captured chunk.')
})

export const toFinalizeArtifactFailure = (error: unknown): RecordingFailureDescriptor => ({
  reason: 'capture_error',
  message: toErrorMessage(error, 'Failed to finalize audio file.')
})

export const toCaptureRuntimeCommandFailure = (
  operation: CaptureRuntimeOperation,
  error: unknown
): RecordingFailureDescriptor => {
  if (operation === 'cancel') {
    return {
      reason: 'aborted',
      message: toErrorMessage(error, 'Failed to cancel capture runtime.')
    }
  }

  if (operation === 'start') {
    return {
      reason: 'capture_error',
      message: toErrorMessage(error, 'Failed to start capture runtime.')
    }
  }

  return {
    reason: 'capture_error',
    message: toErrorMessage(error, 'Failed to stop capture runtime.')
  }
}
