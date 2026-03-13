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

const createWhisperModel = (
  id: string,
  config: {
    label: string
    description: string
    sizeMb: number
    minimumSizeBytes: number
  }
): WhisperModelDefinition => ({
  id,
  label: config.label,
  description: config.description,
  language: 'multilingual',
  sizeMb: config.sizeMb,
  minimumSizeBytes: config.minimumSizeBytes,
  fileName: `ggml-${id}.bin`,
  downloadSources: [`${WHISPER_BASE_DOWNLOAD_URL}/ggml-${id}.bin`]
})

export const WHISPER_MODEL_DEFINITIONS = {
  tiny: createWhisperModel('tiny', {
    label: 'Whisper Tiny',
    description: 'Fastest local model with basic accuracy.',
    sizeMb: 75,
    minimumSizeBytes: 60 * 1024 * 1024
  }),
  base: createWhisperModel('base', {
    label: 'Whisper Base',
    description: 'Balanced speed and quality for general dictation.',
    sizeMb: 142,
    minimumSizeBytes: 110 * 1024 * 1024
  }),
  small: createWhisperModel('small', {
    label: 'Whisper Small',
    description: 'Higher quality with moderate latency.',
    sizeMb: 466,
    minimumSizeBytes: 350 * 1024 * 1024
  }),
  medium: createWhisperModel('medium', {
    label: 'Whisper Medium',
    description: 'High accuracy for longer or noisy recordings.',
    sizeMb: 1500,
    minimumSizeBytes: 1200 * 1024 * 1024
  }),
  'large-v3': createWhisperModel('large-v3', {
    label: 'Whisper Large V3',
    description: 'Top-quality multilingual transcription.',
    sizeMb: 3000,
    minimumSizeBytes: 2500 * 1024 * 1024
  }),
  'large-v3-turbo': createWhisperModel('large-v3-turbo', {
    label: 'Whisper Large V3 Turbo',
    description: 'Large V3 quality optimized for faster throughput.',
    sizeMb: 1600,
    minimumSizeBytes: 1200 * 1024 * 1024
  })
} as const

export type WhisperModelId = keyof typeof WHISPER_MODEL_DEFINITIONS

export const getWhisperModelDefinition = (modelId: WhisperModelId): WhisperModelDefinition =>
  WHISPER_MODEL_DEFINITIONS[modelId]

export const getWhisperModelIds = (): WhisperModelId[] =>
  Object.keys(WHISPER_MODEL_DEFINITIONS) as WhisperModelId[]

export const isSupportedWhisperModelId = (modelId: string): modelId is WhisperModelId =>
  modelId in WHISPER_MODEL_DEFINITIONS
