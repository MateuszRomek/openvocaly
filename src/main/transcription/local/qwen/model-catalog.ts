import { LOCAL_MODELS } from '../../../../shared/local-model-catalog'

type QwenModelFile = {
  name: string
  sizeBytes: number
  sha256: string
}

export type QwenModelDefinition = {
  id: string
  label: string
  description: string
  language: string
  sizeMb: number
  repository: string
  revision: string
  files: readonly QwenModelFile[]
}

const SHARED_FILES = [
  {
    name: 'chat_template.json',
    sizeBytes: 1161,
    sha256: '75a8cfca24f00de72d796fbfed6858fc9614ef3dabd8696684cc3bc03a9c58ff'
  },
  { name: 'config.json', sizeBytes: 0, sha256: '' },
  {
    name: 'generation_config.json',
    sizeBytes: 142,
    sha256: '1da527824d81e07118facff437e03f2e24a23311e3bdeb2368973fe77e5f275c'
  },
  {
    name: 'merges.txt',
    sizeBytes: 1671853,
    sha256: '8831e4f1a044471340f7c0a83d7bd71306a5b867e95fd870f74d0c5308a904d5'
  },
  { name: 'model.safetensors', sizeBytes: 0, sha256: '' },
  { name: 'model.safetensors.index.json', sizeBytes: 0, sha256: '' },
  {
    name: 'preprocessor_config.json',
    sizeBytes: 330,
    sha256: '45e120a4eda2c20c5d7f2ea9354e63536bf35e27aa573fb7cdf78017b378770d'
  },
  {
    name: 'tokenizer_config.json',
    sizeBytes: 12487,
    sha256: '4942d005604266809309cabc9f4e9cb89ce855d59b14681fdc0e1cc62ea26c4c'
  },
  {
    name: 'vocab.json',
    sizeBytes: 2776833,
    sha256: 'ca10d7e9fb3ed18575dd1e277a2579c16d108e32f27439684afa0e10b1440910'
  }
] as const

const createQwenModel = (config: {
  model: (typeof LOCAL_MODELS)['qwen3Asr06b'] | (typeof LOCAL_MODELS)['qwen3Asr17b']
  repository: string
  revision: string
  configBytes: number
  modelBytes: number
  modelSha256: string
  modelIndexBytes: number
  modelIndexSha256: string
  configSha256: string
}): QwenModelDefinition => ({
  id: config.model.id,
  label: config.model.label,
  description: config.model.description,
  language: config.model.language,
  sizeMb: config.model.sizeMb,
  repository: config.repository,
  revision: config.revision,
  files: SHARED_FILES.map((file) => {
    if (file.name === 'config.json') {
      return { ...file, sizeBytes: config.configBytes, sha256: config.configSha256 }
    }
    if (file.name === 'model.safetensors') {
      return { ...file, sizeBytes: config.modelBytes, sha256: config.modelSha256 }
    }
    if (file.name === 'model.safetensors.index.json') {
      return { ...file, sizeBytes: config.modelIndexBytes, sha256: config.modelIndexSha256 }
    }
    return file
  })
})

/**
 * Every model file is pinned to a public MLX Community revision. Electron
 * downloads this manifest itself; the runtime host only ever opens its local
 * directory and cannot trigger an implicit Hub download.
 */
export const QWEN_MODEL_DEFINITIONS = {
  'qwen3-asr-0.6b-mlx-bf16': createQwenModel({
    model: LOCAL_MODELS.qwen3Asr06b,
    repository: 'mlx-community/Qwen3-ASR-0.6B-bf16',
    revision: 'eae2b51f96265328f1e7beced788adb0e4536f92',
    configBytes: 6982,
    modelBytes: 1564921888,
    modelSha256: 'a6e635fd9c8dfd5cdd7465db9bd8c947ab30737b90b83b6b09c304e836bb8a7f',
    modelIndexBytes: 44231,
    modelIndexSha256: '4722310af2af946f54385d2aed98485961f5af0c0a340390ccf3c95f475db6a4',
    configSha256: 'dae1fbfa8b858aceefe5afcc7ecc9184e4a6045bc4a1bca8a41834724f490874'
  }),
  'qwen3-asr-1.7b-mlx-bf16': createQwenModel({
    model: LOCAL_MODELS.qwen3Asr17b,
    repository: 'mlx-community/Qwen3-ASR-1.7B-bf16',
    revision: 'e1f6c266914abc5a46e8756e02580f834a6cf8a7',
    configBytes: 6983,
    modelBytes: 4076186653,
    modelSha256: '2f080a3b769ae469aeaaa2dcb9e13a94141e54c9e6d5a7aa63392e0dc5a51789',
    modelIndexBytes: 51384,
    modelIndexSha256: 'a3ee6037ec82e95dc8577216ac84cf0b3c92cfefc099cf20b2296571f2fb3fc0',
    configSha256: '62fe9a2ba2de536820229e126fdfb35f9910b9a337dc46d3737c3b1ac0a9caa9'
  })
} as const satisfies Record<string, QwenModelDefinition>

export type QwenModelId = keyof typeof QWEN_MODEL_DEFINITIONS

export const getQwenModelIds = (): QwenModelId[] =>
  Object.keys(QWEN_MODEL_DEFINITIONS) as QwenModelId[]

export const getQwenModelDefinition = (modelId: QwenModelId): QwenModelDefinition =>
  QWEN_MODEL_DEFINITIONS[modelId]

export const isSupportedQwenModelId = (modelId: string): modelId is QwenModelId =>
  modelId in QWEN_MODEL_DEFINITIONS

export const getQwenModelDownloadUrl = (model: QwenModelDefinition, fileName: string): string =>
  `https://huggingface.co/${model.repository}/resolve/${model.revision}/${fileName}`
