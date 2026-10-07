export type WhisperModelDefinition = {
  id: string
  label: string
  description: string
  language: string
  sizeMb: number
  sizeBytes: number
  sha256: string
  fileName: string
  downloadSources: readonly string[]
}

const WHISPER_REPOSITORY_REVISION = '5359861c739e955e79d9a303bcbc70fb988958b1'
const WHISPER_BASE_DOWNLOAD_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/${WHISPER_REPOSITORY_REVISION}`

const createWhisperModel = (config: {
  sizeBytes: number
  sha256: string
}): WhisperModelDefinition => {
  const model = LOCAL_MODELS.whisperTurboQ5
  return {
    id: model.id,
    label: model.label,
    description: model.description,
    language: model.language,
    sizeMb: model.sizeMb,
    sizeBytes: config.sizeBytes,
    sha256: config.sha256,
    fileName: `ggml-${model.id}.bin`,
    downloadSources: [`${WHISPER_BASE_DOWNLOAD_URL}/ggml-${model.id}.bin`]
  }
}

export const WHISPER_MODEL_DEFINITIONS = {
  'large-v3-turbo-q5_0': createWhisperModel({
    sizeBytes: 574041195,
    sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2'
  })
} as const

export type WhisperModelId = keyof typeof WHISPER_MODEL_DEFINITIONS

export const getWhisperModelDefinition = (modelId: WhisperModelId): WhisperModelDefinition =>
  WHISPER_MODEL_DEFINITIONS[modelId]

export const getWhisperModelIds = (): WhisperModelId[] =>
  Object.keys(WHISPER_MODEL_DEFINITIONS) as WhisperModelId[]

export const isSupportedWhisperModelId = (modelId: string): modelId is WhisperModelId =>
  modelId in WHISPER_MODEL_DEFINITIONS
import { LOCAL_MODELS } from '../../../../shared/local-model-catalog'
