import type {
  TranscriptionPreferences,
  TranscriptionPreferencesUpdateInput
} from '../../../shared/transcription'
import {
  DEFAULT_TRANSCRIPTION_MODEL_ID,
  DEFAULT_TRANSCRIPTION_PROVIDER_ID
} from '../../../shared/transcription'
import {
  isTranscriptionProviderId,
  isSelectableTranscriptionProviderId,
  resolveDefaultTranscriptionModelId,
  resolveDefaultTranscriptionProviderId,
  resolveTranscriptionModelId
} from '../provider-helpers'

export const createDefaultPreferences = (): TranscriptionPreferences => ({
  providerId: resolveDefaultTranscriptionProviderId(),
  modelId: DEFAULT_TRANSCRIPTION_MODEL_ID
})

const normalizePreferences = (
  params: TranscriptionPreferencesUpdateInput | Partial<TranscriptionPreferences> | undefined,
  fallback: TranscriptionPreferences
): TranscriptionPreferences => {
  const providerId = isTranscriptionProviderId(params?.providerId)
    ? params.providerId
    : isSelectableTranscriptionProviderId(fallback.providerId)
      ? fallback.providerId
      : DEFAULT_TRANSCRIPTION_PROVIDER_ID

  const normalizedProviderId = isSelectableTranscriptionProviderId(providerId)
    ? providerId
    : resolveDefaultTranscriptionProviderId()

  const modelCandidate =
    typeof params?.modelId === 'string'
      ? params.modelId
      : typeof fallback.modelId === 'string'
        ? fallback.modelId
        : resolveDefaultTranscriptionModelId(normalizedProviderId)

  return {
    providerId: normalizedProviderId,
    modelId: resolveTranscriptionModelId(normalizedProviderId, modelCandidate)
  }
}

export const mergePreferences = (
  base: TranscriptionPreferences,
  patch?: TranscriptionPreferencesUpdateInput
): TranscriptionPreferences => normalizePreferences(patch, base)

export const resolveLoadedPreferences = (
  parsed: Partial<TranscriptionPreferences>
): TranscriptionPreferences => normalizePreferences(parsed, createDefaultPreferences())
