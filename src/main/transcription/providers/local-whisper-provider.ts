import type { TranscriptionProviderDefinition } from './types'
import { LocalWhisperError } from '../local/whisper/errors'
import { whisperRuntime } from '../local/whisper/runtime'
import { getWhisperModelDefinition, getWhisperModelIds } from '../local/whisper/model-catalog'

const WHISPER_MODELS = getWhisperModelIds().map((modelId) => {
  const definition = getWhisperModelDefinition(modelId)

  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    sizeMb: definition.sizeMb,
    language: definition.language
  }
})

export const localWhisperProvider: TranscriptionProviderDefinition = {
  id: 'local-whisper',
  label: 'Local Whisper.cpp',
  kind: 'local',
  availability: process.platform === 'darwin' ? 'available' : 'coming_soon',
  isModelDownloaded: (modelId) => whisperRuntime.isModelDownloaded(modelId),
  validateBeforeTranscribe: ({ modelId }) => {
    const runtimeStatus = whisperRuntime.getRuntimeStatus()
    if (!runtimeStatus.status.platformSupported || !runtimeStatus.status.available) {
      return 'local_runtime_unavailable'
    }

    if (!whisperRuntime.isModelDownloaded(modelId)) {
      return 'local_model_not_downloaded'
    }

    return null
  },
  models: WHISPER_MODELS,
  transcribe: async (artifact, context) => {
    try {
      const result = await whisperRuntime.transcribeArtifact(
        artifact.filePath,
        context.modelId,
        context.signal
      )
      const text = result.text.trim()
      const diagnostics = {
        ...result.diagnostics,
        providerId: 'local-whisper' as const,
        modelId: context.modelId
      }

      if (!text.length) {
        return {
          ok: false,
          code: 'empty_transcription',
          message: 'No speech detected in local Whisper result.',
          diagnostics
        }
      }

      return {
        ok: true,
        transcript: {
          text,
          language: result.language,
          durationMs: result.diagnostics.durationMs
        },
        diagnostics
      }
    } catch (error) {
      if (error instanceof LocalWhisperError) {
        return {
          ok: false,
          code: error.code,
          message: error.message
        }
      }

      const message = error instanceof Error ? error.message : 'Local Whisper transcription failed.'
      return {
        ok: false,
        code: 'local_transcription_failed',
        message
      }
    }
  }
}
