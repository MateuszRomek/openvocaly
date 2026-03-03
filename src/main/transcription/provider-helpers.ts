import type { TranscriptionProviderId } from '../../shared/transcription'
import {
  DEFAULT_TRANSCRIPTION_MODEL_ID,
  DEFAULT_TRANSCRIPTION_PROVIDER_ID
} from '../../shared/transcription'
import {
  getAvailableTranscriptionProviders,
  transcriptionProviders,
  transcriptionProvidersById
} from './providers'

export const isTranscriptionProviderId = (value: unknown): value is TranscriptionProviderId =>
  typeof value === 'string' && transcriptionProvidersById.has(value as TranscriptionProviderId)

export const isSelectableTranscriptionProviderId = (
  value: unknown
): value is TranscriptionProviderId => {
  if (!isTranscriptionProviderId(value)) {
    return false
  }

  const provider = transcriptionProvidersById.get(value)
  return provider?.availability === 'available'
}

export const resolveDefaultTranscriptionProviderId = (): TranscriptionProviderId => {
  const fallbackProviderId = transcriptionProviders[0]?.id ?? DEFAULT_TRANSCRIPTION_PROVIDER_ID

  return isSelectableTranscriptionProviderId(DEFAULT_TRANSCRIPTION_PROVIDER_ID)
    ? DEFAULT_TRANSCRIPTION_PROVIDER_ID
    : (getAvailableTranscriptionProviders()[0]?.id ?? fallbackProviderId)
}

const findModel = (providerId: TranscriptionProviderId, modelId: string): string | null => {
  const provider = transcriptionProvidersById.get(providerId)
  if (!provider) {
    return null
  }

  const model = provider.models.find((candidate) => candidate.id === modelId)
  return model ? model.id : null
}

export const resolveDefaultTranscriptionModelId = (providerId: TranscriptionProviderId): string => {
  const provider = transcriptionProvidersById.get(providerId)

  if (!provider || provider.models.length === 0) {
    return DEFAULT_TRANSCRIPTION_MODEL_ID
  }

  const defaultModel = provider.models.find((model) => model.id === DEFAULT_TRANSCRIPTION_MODEL_ID)
  return defaultModel?.id ?? provider.models[0].id
}

export const resolveTranscriptionModelId = (
  providerId: TranscriptionProviderId,
  preferredModelId: unknown
): string => {
  if (typeof preferredModelId !== 'string') {
    return resolveDefaultTranscriptionModelId(providerId)
  }

  return findModel(providerId, preferredModelId) ?? resolveDefaultTranscriptionModelId(providerId)
}
