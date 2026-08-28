import { describe, expect, it } from 'vitest'
import { getQwenModelDefinition, getQwenModelDownloadUrl, getQwenModelIds } from './model-catalog'

describe('Qwen MLX model catalog', () => {
  it('pins both supported models to immutable public revisions', () => {
    expect(getQwenModelIds()).toEqual(['qwen3-asr-0.6b-mlx-bf16', 'qwen3-asr-1.7b-mlx-bf16'])

    for (const modelId of getQwenModelIds()) {
      const model = getQwenModelDefinition(modelId)
      expect(model.revision).toMatch(/^[a-f0-9]{40}$/)
      expect(model.files.find((file) => file.name === 'model.safetensors')?.sha256).toMatch(
        /^[a-f0-9]{64}$/
      )
    }
  })

  it('builds revision-pinned model download URLs', () => {
    const model = getQwenModelDefinition('qwen3-asr-0.6b-mlx-bf16')
    expect(getQwenModelDownloadUrl(model, 'model.safetensors')).toBe(
      'https://huggingface.co/mlx-community/Qwen3-ASR-0.6B-bf16/resolve/eae2b51f96265328f1e7beced788adb0e4536f92/model.safetensors'
    )
  })
})
