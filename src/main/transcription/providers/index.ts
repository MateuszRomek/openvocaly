import type { TranscriptionProviderId } from '../../../shared/transcription'
import { localParakeetProvider } from './local-parakeet-provider'
import { localWhisperProvider } from './local-whisper-provider'
import type { TranscriptionProviderDefinition } from './types'

export const transcriptionProviders: TranscriptionProviderDefinition[] = [
  localParakeetProvider,
  localWhisperProvider
]

export const transcriptionProvidersById = new Map<
  TranscriptionProviderId,
  TranscriptionProviderDefinition
>(transcriptionProviders.map((provider) => [provider.id, provider]))

export const getAvailableTranscriptionProviders = (): TranscriptionProviderDefinition[] =>
  transcriptionProviders.filter((provider) => provider.availability === 'available')

export type { LocalProviderTranscriptionContext, TranscriptionProviderDefinition } from './types'
