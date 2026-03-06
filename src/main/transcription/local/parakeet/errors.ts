export type LocalParakeetErrorCode =
  | 'local_runtime_unavailable'
  | 'local_model_not_downloaded'
  | 'local_model_download_failed'
  | 'local_transcription_failed'

export class LocalParakeetError extends Error {
  constructor(
    readonly code: LocalParakeetErrorCode,
    message: string
  ) {
    super(message)
  }
}
