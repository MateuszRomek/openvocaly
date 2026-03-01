import type { RecordingArtifact } from '../../shared/recording'

export type TranscriptionSuccessResult = {
  ok: true
}

export type TranscriptionFailureResult = {
  ok: false
  message?: string
}

export type TranscriptionResult = TranscriptionSuccessResult | TranscriptionFailureResult

export interface TranscriptionProvider {
  transcribe(artifact: RecordingArtifact): Promise<TranscriptionResult>
}

/**
 * Temporary transcription implementation used during local development.
 *
 * This keeps the orchestration flow operational before wiring a real provider
 * and supports deterministic failure-path testing via env flag.
 */
class PlaceholderTranscriptionProvider implements TranscriptionProvider {
  async transcribe(): Promise<TranscriptionResult> {
    if (process.env['WISPR_RECORDING_FORCE_TRANSCRIPTION_FAILURE'] === '1') {
      return {
        ok: false,
        message: 'Forced transcription failure from WISPR_RECORDING_FORCE_TRANSCRIPTION_FAILURE=1'
      }
    }

    return { ok: true }
  }
}

export const transcriptionProvider: TranscriptionProvider = new PlaceholderTranscriptionProvider()
