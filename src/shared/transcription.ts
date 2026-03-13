export const DEFAULT_TRANSCRIPTION_PROVIDER_ID = 'groq' as const
export const DEFAULT_TRANSCRIPTION_MODEL_ID = 'whisper-large-v3-turbo' as const

export type TranscriptionProviderId =
  | 'groq'
  | 'openai'
  | 'elevenlabs'
  | 'gemini'
  | 'local-parakeet'
  | 'local-whisper'
export type TranscriptionProviderAvailability = 'available' | 'coming_soon'
export type TranscriptionProviderKind = 'cloud' | 'local'

export type TranscriptionProviderModel = {
  id: string
  label: string
  description?: string
  sizeMb?: number
  downloaded?: boolean
  language?: string
}

type BaseTranscriptionProviderOption = {
  id: TranscriptionProviderId
  label: string
  kind: TranscriptionProviderKind
  models: TranscriptionProviderModel[]
  isConfigured: boolean
  availability: TranscriptionProviderAvailability
}

export type CloudTranscriptionProviderOption = BaseTranscriptionProviderOption & {
  kind: 'cloud'
  apiKeyPreview: string | null
}

export type LocalTranscriptionProviderOption = BaseTranscriptionProviderOption & {
  kind: 'local'
  apiKeyPreview: null
}

export type TranscriptionProviderOption =
  | CloudTranscriptionProviderOption
  | LocalTranscriptionProviderOption

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
  | 'missing_api_key'
  | 'invalid_api_key'
  | 'provider_request_failed'
  | 'local_runtime_unavailable'
  | 'local_model_not_downloaded'
  | 'local_model_download_failed'
  | 'local_transcription_failed'
  | 'empty_transcription'
  | 'storage_failed'

export type TranscriptionFailureResult = {
  ok: false
  message?: string
  code?: TranscriptionFailureCode
}

export type TranscriptionResult = TranscriptionSuccessResult | TranscriptionFailureResult
