import { LOCAL_PARAKEET_MODEL_ID } from '../../../../shared/local-transcription'

export type ParakeetModelId = typeof LOCAL_PARAKEET_MODEL_ID

export type ParakeetModelDefinition = {
  id: ParakeetModelId
  label: string
  description: string
  language: string
  sizeMb: number
  // Ordered download mirrors for the same artifact; we try each URL until one succeeds.
  downloadSources: readonly string[]
  // Directory name expected after archive extraction.
  extractDir: string
}

// Files required by sherpa-onnx runtime startup. Missing any of these means the model install is invalid.
export const PARAKEET_REQUIRED_MODEL_FILES = [
  'encoder.int8.onnx',
  'decoder.int8.onnx',
  'joiner.int8.onnx',
  'tokens.txt'
] as const

export const PARAKEET_MODEL_DEFINITIONS: Record<ParakeetModelId, ParakeetModelDefinition> = {
  [LOCAL_PARAKEET_MODEL_ID]: {
    id: LOCAL_PARAKEET_MODEL_ID,
    label: 'NVIDIA Parakeet TDT 0.6B v3',
    description: 'Fast multilingual local transcription (25 languages).',
    language: 'multilingual',
    sizeMb: 680,
    downloadSources: [
      'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2'
    ],
    extractDir: 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8'
  }
}

export const getParakeetModelDefinition = (modelId: ParakeetModelId): ParakeetModelDefinition =>
  PARAKEET_MODEL_DEFINITIONS[modelId]

export const getParakeetModelIds = (): ParakeetModelId[] =>
  Object.keys(PARAKEET_MODEL_DEFINITIONS) as ParakeetModelId[]

export const isSupportedParakeetModelId = (modelId: string): modelId is ParakeetModelId =>
  modelId in PARAKEET_MODEL_DEFINITIONS
