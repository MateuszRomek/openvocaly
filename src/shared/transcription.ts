export const DEFAULT_TRANSCRIPTION_PROVIDER_ID = 'local-parakeet' as const
export const DEFAULT_TRANSCRIPTION_MODEL_ID = 'parakeet-tdt-0.6b-v3' as const

export type TranscriptionProviderId = 'local-parakeet' | 'local-whisper'
export type TranscriptionProviderAvailability = 'available' | 'coming_soon'
export type TranscriptionProviderKind = 'local'

export type TranscriptionProviderModel = {
  id: string
  label: string
  description?: string
  sizeMb?: number
  downloaded?: boolean
  language?: string
}

export type TranscriptionProviderOption = {
  id: TranscriptionProviderId
  label: string
  models: TranscriptionProviderModel[]
  isConfigured: boolean
  availability: TranscriptionProviderAvailability
  kind: 'local'
}

export type TranscriptionPreferences = {
  providerId: TranscriptionProviderId
  modelId: string
}

export type TranscriptionConfig = {
  providers: TranscriptionProviderOption[]
}

export type TranscriptionPreferencesResponse = {
  preferences: TranscriptionPreferences
  config: TranscriptionConfig
}

export type TranscriptionPreferencesUpdateInput = Partial<TranscriptionPreferences>

export type TranscriptionSuccessResult = {
  ok: true
  transcript: {
    text: string
    language?: string
    durationMs?: number
    confidence?: number
  }
  diagnostics?: TranscriptionDiagnostics
}

export type TranscriptionDiagnosticsResultType =
  | 'success_full'
  | 'success_partial'
  | 'failed_empty'
  | 'failed_runtime'
  | 'failed_timeout'
  | 'failed_protocol'

export type TranscriptionChunkDiagnostics = {
  chunkIndex: number
  chunkCount: number
  attempt: number
  restarted: boolean
  resultType: TranscriptionDiagnosticsResultType
  elapsedMs: number
  message?: string
}

export type TranscriptionDiagnostics = {
  providerId?: TranscriptionProviderId
  modelId?: string
  partial?: boolean
  resultType?: TranscriptionDiagnosticsResultType
  durationMs?: number
  chunkCount?: number
  chunkDurationSeconds?: number
  chunkOverlapMs?: number
  failedChunkIndexes?: number[]
  chunks?: TranscriptionChunkDiagnostics[]
}

export type TranscriptionFailureCode =
  | 'forced_failure'
  | 'provider_not_supported'
  | 'provider_unavailable'
  | 'provider_not_configured'
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
  diagnostics?: TranscriptionDiagnostics
}

export type TranscriptionResult = TranscriptionSuccessResult | TranscriptionFailureResult
