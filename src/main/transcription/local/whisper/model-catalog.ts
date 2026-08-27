export type WhisperModelDefinition = {
  id: string
  label: string
  description: string
  language: string
  sizeMb: number
  minimumSizeBytes: number
  fileName: string
  downloadSources: readonly string[]
}

const WHISPER_BASE_DOWNLOAD_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'

const createWhisperModel = (config: { minimumSizeBytes: number }): WhisperModelDefinition => {
  const model = LOCAL_MODELS.whisperTurboQ5
  return {
    id: model.id,
    label: model.label,
    description: model.description,
    language: model.language,
    sizeMb: model.sizeMb,
    minimumSizeBytes: config.minimumSizeBytes,
    fileName: `ggml-${model.id}.bin`,
    downloadSources: [`${WHISPER_BASE_DOWNLOAD_URL}/ggml-${model.id}.bin`]
  }
}

export const WHISPER_MODEL_DEFINITIONS = {
  'large-v3-turbo-q5_0': createWhisperModel({ minimumSizeBytes: 500 * 1024 * 1024 })
} as const

export type WhisperModelId = keyof typeof WHISPER_MODEL_DEFINITIONS

export const getWhisperModelDefinition = (modelId: WhisperModelId): WhisperModelDefinition =>
  WHISPER_MODEL_DEFINITIONS[modelId]

export const getWhisperModelIds = (): WhisperModelId[] =>
  Object.keys(WHISPER_MODEL_DEFINITIONS) as WhisperModelId[]

export const isSupportedWhisperModelId = (modelId: string): modelId is WhisperModelId =>
  modelId in WHISPER_MODEL_DEFINITIONS
import { LOCAL_MODELS } from '../../../../shared/local-model-catalog'
