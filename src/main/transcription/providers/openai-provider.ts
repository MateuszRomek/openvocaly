import type { TranscriptionProviderDefinition } from './types'

export const openAiProvider: TranscriptionProviderDefinition = {
  id: 'openai',
  label: 'OpenAI',
  kind: 'cloud',
  availability: 'coming_soon',
  models: [{ id: 'whisper-1', label: 'Whisper 1' }]
}
