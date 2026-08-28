import { describe, expect, it } from 'vitest'
import type { TranscriptionConfig } from './transcription'
import { getDownloadedMeetingModels } from './meetings'

describe('getDownloadedMeetingModels', () => {
  it('returns only downloaded models from available local providers', () => {
    const config: TranscriptionConfig = {
      providers: [
        {
          id: 'local-parakeet',
          label: 'Parakeet',
          kind: 'local',
          availability: 'available',
          isConfigured: true,
          models: [
            {
              id: 'parakeet',
              label: 'Parakeet',
              downloaded: true
            },
            {
              id: 'missing',
              label: 'Missing',
              downloaded: false
            }
          ]
        },
        {
          id: 'local-qwen',
          label: 'Qwen',
          kind: 'local',
          availability: 'coming_soon',
          isConfigured: false,
          models: [
            {
              id: 'qwen',
              label: 'Qwen',
              downloaded: true
            }
          ]
        }
      ]
    }

    expect(getDownloadedMeetingModels(config)).toEqual([
      {
        providerId: 'local-parakeet',
        providerLabel: 'Parakeet',
        modelId: 'parakeet',
        label: 'Parakeet',
        description: undefined,
        sizeMb: undefined,
        language: undefined
      }
    ])
  })
})
