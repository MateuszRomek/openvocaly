import type { TranscriptionProviderDefinition } from './types'

export const elevenLabsProvider: TranscriptionProviderDefinition = {
  id: 'elevenlabs',
  label: 'ElevenLabs',
  kind: 'cloud',
  availability: 'coming_soon',
  models: [{ id: 'scribe-v1', label: 'Scribe V1' }]
}
