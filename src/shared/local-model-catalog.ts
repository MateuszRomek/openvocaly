export type LocalAsrEngineId = 'macos-parakeet-coreml' | 'whisper-cpp'

export type LocalModelDefinition = {
  id: string
  engineId: LocalAsrEngineId
  label: string
  description: string
  language: 'multilingual'
  sizeMb: number
  isDefault: boolean
}

/**
 * The complete, intentionally small set of end-user-installable dictation
 * models. Engine-specific download and execution details stay out of shared
 * code so future hosts can support the same model ids without changing UI or
 * persisted preferences.
 */
export const LOCAL_MODELS = {
  parakeet: {
    id: 'parakeet-tdt-0.6b-v3-coreml',
    engineId: 'macos-parakeet-coreml',
    label: 'Parakeet v3',
    description: 'Fast multilingual dictation optimized for Apple Silicon.',
    language: 'multilingual',
    sizeMb: 680,
    isDefault: true
  },
  whisperTurboQ5: {
    id: 'large-v3-turbo-q5_0',
    engineId: 'whisper-cpp',
    label: 'Whisper Turbo Q5',
    description: 'Smaller, high-quality multilingual fallback for Apple Silicon.',
    language: 'multilingual',
    sizeMb: 574,
    isDefault: false
  }
} as const satisfies Record<string, LocalModelDefinition>

export type LocalModelId = (typeof LOCAL_MODELS)[keyof typeof LOCAL_MODELS]['id']

const localModels = Object.values(LOCAL_MODELS)

export const getSelectableLocalModels = (): readonly LocalModelDefinition[] => localModels

export const getLocalModelsForEngine = (
  engineId: LocalAsrEngineId
): readonly LocalModelDefinition[] => localModels.filter((model) => model.engineId === engineId)

export const getLocalModelDefinition = (modelId: string): LocalModelDefinition | undefined =>
  localModels.find((model) => model.id === modelId)

export const getDefaultLocalModel = (): LocalModelDefinition => {
  const defaultModel = localModels.find((model) => model.isDefault)

  if (!defaultModel) {
    throw new Error('The local model catalog must declare one default model.')
  }

  return defaultModel
}
