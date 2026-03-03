export const DEFAULT_TRANSCRIPTION_PROVIDER_ID = 'groq' as const
export const DEFAULT_TRANSCRIPTION_MODEL_ID = 'whisper-large-v3-turbo' as const

export type TranscriptionProviderId = 'groq' | 'openai' | 'elevenlabs' | 'gemini'
export type TranscriptionProviderAvailability = 'available' | 'coming_soon'

export type TranscriptionProviderModel = {
  id: string
  label: string
}

export type TranscriptionProviderOption = {
  id: TranscriptionProviderId
  label: string
  models: TranscriptionProviderModel[]
  isConfigured: boolean
  apiKeyPreview: string | null
  availability: TranscriptionProviderAvailability
}

export type TranscriptionPreferences = {
  providerId: TranscriptionProviderId
  modelId: string
}

export type TranscriptionConfig = {
  secureStorageAvailable: boolean
  providers: TranscriptionProviderOption[]
}

export type TranscriptionPreferencesResponse = {
  preferences: TranscriptionPreferences
  config: TranscriptionConfig
}

export type TranscriptionPreferencesUpdateInput = Partial<TranscriptionPreferences>

export type TranscriptionProviderApiKeyUpdateInput = {
  providerId: TranscriptionProviderId
  apiKey: string
}

export type TranscriptionProviderApiKeyClearInput = {
  providerId: TranscriptionProviderId
}

export type TranscriptionProviderApiKeyMutationResponse = {
  ok: boolean
  message?: string
}

export type TranscriptionSuccessResult = {
  ok: true
  transcript: {
    text: string
    language?: string
    durationMs?: number
    confidence?: number
  }
}

export type TranscriptionFailureCode =
  | 'forced_failure'
  | 'provider_not_supported'
  | 'provider_unavailable'
  | 'provider_not_configured'
  | 'invalid_api_key'
  | 'provider_request_failed'
  | 'empty_transcription'
  | 'storage_failed'

export type TranscriptionFailureResult = {
  ok: false
  message?: string
  code?: TranscriptionFailureCode
}

export type TranscriptionResult = TranscriptionSuccessResult | TranscriptionFailureResult
