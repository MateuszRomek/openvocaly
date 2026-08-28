import { describe, expect, it } from 'vitest'
import { isLocalModelSelectionPending } from './local-model-selection'

describe('local model selection state', () => {
  it('only marks the model being selected as pending', () => {
    const target = {
      providerId: 'local-parakeet',
      modelId: 'parakeet-tdt-0.6b-v3-coreml'
    }

    expect(
      isLocalModelSelectionPending(target, 'local-parakeet', 'parakeet-tdt-0.6b-v3-coreml')
    ).toBe(true)
    expect(isLocalModelSelectionPending(target, 'local-parakeet', 'another-model')).toBe(false)
    expect(isLocalModelSelectionPending(target, 'local-whisper', 'large-v3-turbo-q5_0')).toBe(false)
  })

  it('does not mark any model pending when selection is settled', () => {
    expect(
      isLocalModelSelectionPending(null, 'local-parakeet', 'parakeet-tdt-0.6b-v3-coreml')
    ).toBe(false)
  })
})
