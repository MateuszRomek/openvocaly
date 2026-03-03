import type { TranscriptionProviderDefinition } from './types'

export const openAiProvider: TranscriptionProviderDefinition = {
  id: 'openai',
  label: 'OpenAI',
  availability: 'coming_soon',
  models: [{ id: 'whisper-1', label: 'Whisper 1' }]
}
