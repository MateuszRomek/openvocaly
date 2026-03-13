export type LocalWhisperErrorCode =
  | 'local_runtime_unavailable'
  | 'local_model_not_downloaded'
  | 'local_model_download_failed'
  | 'local_transcription_failed'

export class LocalWhisperError extends Error {
  constructor(
    readonly code: LocalWhisperErrorCode,
    message: string
  ) {
    super(message)
  }
}
