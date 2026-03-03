import type { TranscriptionProviderDefinition } from './types'

export const geminiProvider: TranscriptionProviderDefinition = {
  id: 'gemini',
  label: 'Gemini',
  availability: 'coming_soon',
  models: [{ id: 'gemini-2.0-flash-transcribe', label: 'Gemini 2.0 Flash Transcribe' }]
}
