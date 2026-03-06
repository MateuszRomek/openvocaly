import type { TranscriptionProviderDefinition } from './types'
import { LocalParakeetError } from '../local/parakeet/errors'
import { parakeetRuntime } from '../local/parakeet/runtime'
import { LOCAL_PARAKEET_MODEL_ID } from '../../../shared/local-transcription'

export const localParakeetProvider: TranscriptionProviderDefinition = {
  id: 'local-parakeet',
  label: 'Local NVIDIA Parakeet v3',
  kind: 'local',
  availability: process.platform === 'darwin' ? 'available' : 'coming_soon',
  isModelDownloaded: (modelId) => parakeetRuntime.isModelDownloaded(modelId),
  validateBeforeTranscribe: ({ modelId }) => {
    const runtimeStatus = parakeetRuntime.getRuntimeStatus()
    if (!runtimeStatus.status.platformSupported || !runtimeStatus.status.available) {
      return 'local_runtime_unavailable'
    }

    if (!parakeetRuntime.isModelDownloaded(modelId)) {
      return 'local_model_not_downloaded'
    }

    return null
  },
  models: [
    {
      id: LOCAL_PARAKEET_MODEL_ID,
      label: 'Parakeet TDT 0.6B v3',
      description: 'Fast multilingual local transcription',
      sizeMb: 680,
      language: 'multilingual'
    }
  ],
  transcribe: async (artifact, context) => {
    try {
      const result = await parakeetRuntime.transcribeArtifact(artifact.filePath, context.modelId)
      const text = result.text.trim()

      if (!text.length) {
        return {
          ok: false,
          code: 'empty_transcription',
          message: 'No speech detected in local transcription result.'
        }
      }

      return {
        ok: true,
        transcript: {
          text,
          language: result.language
        }
      }
    } catch (error) {
      if (error instanceof LocalParakeetError) {
        return {
          ok: false,
          code: error.code,
          message: error.message
        }
      }

      const message =
        error instanceof Error ? error.message : 'Local Parakeet transcription failed.'
      return {
        ok: false,
        code: 'local_transcription_failed',
        message
      }
    }
  }
}
