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
    expect(getLocalModelsForEngine('qwen3-asr-mlx')).toEqual([
      LOCAL_MODELS.qwen3Asr06b,
      LOCAL_MODELS.qwen3Asr17b
    ])
  })

  it('offers the intentionally small local-model picker', () => {
    expect(getSelectableLocalModels().map((model) => model.id)).toEqual([
      'parakeet-tdt-0.6b-v3-coreml',
      'large-v3-turbo-q5_0',
      'qwen3-asr-0.6b-mlx-bf16',
      'qwen3-asr-1.7b-mlx-bf16'
    ])
  })

  it('resolves a model by its stable persisted id', () => {
    expect(getLocalModelDefinition('large-v3-turbo-q5_0')).toBe(LOCAL_MODELS.whisperTurboQ5)
    expect(getLocalModelDefinition('large-v3')).toBeUndefined()
  })
})
