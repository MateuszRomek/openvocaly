import { LocalQwenError } from '../local/qwen/errors'
import { getQwenModelDefinition, getQwenModelIds } from '../local/qwen/model-catalog'
import { qwenRuntime } from '../local/qwen/runtime'
import { isQwenMlxSupported } from '../local/qwen-mlx-host/runtime-discovery'
import type { TranscriptionProviderDefinition } from './types'

const QWEN_MODELS = getQwenModelIds().map((modelId) => {
  const definition = getQwenModelDefinition(modelId)
  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    sizeMb: definition.sizeMb,
    language: definition.language
  }
})

export const localQwenProvider: TranscriptionProviderDefinition = {
  id: 'local-qwen',
  label: 'Local Qwen3-ASR (MLX)',
  kind: 'local',
  availability: isQwenMlxSupported() ? 'available' : 'coming_soon',
  isModelDownloaded: (modelId) => qwenRuntime.isModelDownloaded(modelId),
  validateBeforeTranscribe: ({ modelId }) => {
    const runtimeStatus = qwenRuntime.getRuntimeStatus()
    if (!runtimeStatus.status.platformSupported || !runtimeStatus.status.available) {
      return 'local_runtime_unavailable'
    }
    return qwenRuntime.isModelDownloaded(modelId) ? null : 'local_model_not_downloaded'
  },
  models: QWEN_MODELS,
  transcribe: async (artifact, context) => {
    try {
      const result = await qwenRuntime.transcribeArtifact(
        artifact.filePath,
        context.modelId,
        context.signal
      )
      const text = result.text.trim()
      const diagnostics = {
        ...result.diagnostics,
        providerId: 'local-qwen' as const,
        modelId: context.modelId
      }
      if (!text.length) {
        return {
          ok: false,
          code: 'empty_transcription',
          message: 'No speech detected in local Qwen result.',
          diagnostics
        }
      }
      return {
        ok: true,
        transcript: { text, language: result.language, durationMs: result.diagnostics.durationMs },
        diagnostics
      }
    } catch (error) {
      if (error instanceof LocalQwenError) {
        return { ok: false, code: error.code, message: error.message }
      }
      return {
        ok: false,
        code: 'local_transcription_failed',
        message: error instanceof Error ? error.message : 'Local Qwen transcription failed.'
      }
    }
  }
}
