import type { TranscriptionProviderDefinition } from './types'
import { LOCAL_MODELS } from '../../../shared/local-model-catalog'
import { LocalParakeetError } from '../local/parakeet/errors'
import { macOSParakeetRuntime } from '../local/macos-asr-host/runtime'
import { isMacOSParakeetSupported } from '../local/macos-asr-host/runtime-discovery'

const PARAKEET_MODEL = LOCAL_MODELS.parakeet

export const localParakeetProvider: TranscriptionProviderDefinition = {
  id: 'local-parakeet',
  label: 'Local NVIDIA Parakeet v3',
  kind: 'local',
  availability: isMacOSParakeetSupported() ? 'available' : 'coming_soon',
  isModelDownloaded: (modelId) => macOSParakeetRuntime.isModelDownloaded(modelId),
  validateBeforeTranscribe: ({ modelId }) => {
    const runtimeStatus = macOSParakeetRuntime.getRuntimeStatus()
    if (!runtimeStatus.status.platformSupported || !runtimeStatus.status.available) {
      return 'local_runtime_unavailable'
    }

    if (!macOSParakeetRuntime.isModelDownloaded(modelId)) {
      return 'local_model_not_downloaded'
    }

    return null
  },
  models: [
    {
      id: PARAKEET_MODEL.id,
      label: PARAKEET_MODEL.label,
      description: PARAKEET_MODEL.description,
      sizeMb: PARAKEET_MODEL.sizeMb,
      language: PARAKEET_MODEL.language
    }
  ],
  transcribe: async (artifact, context) => {
    try {
      const result = await macOSParakeetRuntime.transcribeArtifact(
        artifact.filePath,
        context.modelId
      )
      const text = result.text.trim()
      const diagnostics = {
        ...result.diagnostics,
        providerId: 'local-parakeet' as const,
        modelId: context.modelId
      }

      if (!text.length) {
        return {
          ok: false,
          code: 'empty_transcription',
          message: 'No speech detected in local transcription result.',
          diagnostics
        }
      }

      return {
        ok: true,
        transcript: {
          text,
          language: result.language
        },
        diagnostics
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
