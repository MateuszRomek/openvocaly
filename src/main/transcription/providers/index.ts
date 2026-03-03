import type { TranscriptionProviderId } from '../../../shared/transcription'
import { elevenLabsProvider } from './elevenlabs-provider'
import { geminiProvider } from './gemini-provider'
import { groqProvider } from './groq-provider'
import { openAiProvider } from './openai-provider'
import type { TranscriptionProviderDefinition } from './types'

export const transcriptionProviders: TranscriptionProviderDefinition[] = [
  groqProvider,
  openAiProvider,
  elevenLabsProvider,
  geminiProvider
]

export const transcriptionProvidersById = new Map<
  TranscriptionProviderId,
  TranscriptionProviderDefinition
>(transcriptionProviders.map((provider) => [provider.id, provider]))

export const getAvailableTranscriptionProviders = (): TranscriptionProviderDefinition[] =>
  transcriptionProviders.filter((provider) => provider.availability === 'available')

export type { ProviderTranscriptionContext, TranscriptionProviderDefinition } from './types'
