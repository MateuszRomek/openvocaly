import { describe, expect, it } from 'vitest'
import {
  getLocalModelDefinition,
  getLocalModelsForEngine,
  getSelectableLocalModels,
  LOCAL_MODELS
} from './local-model-catalog'

describe('local model catalog', () => {
  it('exposes Parakeet as the default macOS dictation model', () => {
    const [defaultModel] = getSelectableLocalModels()

    expect(defaultModel).toMatchObject({
      id: 'parakeet-tdt-0.6b-v3-coreml',
      engineId: 'macos-parakeet-coreml',
      isDefault: true
    })
  })

  it('keeps only the supported model for each local engine', () => {
    expect(getLocalModelsForEngine('macos-parakeet-coreml')).toEqual([LOCAL_MODELS.parakeet])
    expect(getLocalModelsForEngine('whisper-cpp')).toEqual([LOCAL_MODELS.whisperTurboQ5])
  })

  it('does not reintroduce the legacy Whisper picker models', () => {
    expect(getSelectableLocalModels().map((model) => model.id)).toEqual([
      'parakeet-tdt-0.6b-v3-coreml',
      'large-v3-turbo-q5_0'
    ])
  })

  it('resolves a model by its stable persisted id', () => {
    expect(getLocalModelDefinition('large-v3-turbo-q5_0')).toBe(LOCAL_MODELS.whisperTurboQ5)
    expect(getLocalModelDefinition('large-v3')).toBeUndefined()
  })
})
