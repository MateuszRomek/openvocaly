import type { TranscriptionFailureCode } from '../../../../shared/transcription'

export class LocalQwenError extends Error {
  constructor(
    readonly code: TranscriptionFailureCode,
    message: string
  ) {
    super(message)
    this.name = 'LocalQwenError'
  }
}
