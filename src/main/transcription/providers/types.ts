import type {
  TranscriptionFailureCode,
  TranscriptionProviderAvailability,
  TranscriptionProviderId,
  TranscriptionProviderModel,
  TranscriptionResult
} from '../../../shared/transcription'

export type TranscriptionArtifact = {
  sessionId: string
  filePath: string
}

export type LocalProviderTranscriptionContext = {
  modelId: string
  signal?: AbortSignal
}

export type ProviderReadinessContext = {
  modelId: string
}

export type TranscriptionProviderDefinition = {
  id: TranscriptionProviderId
  label: string
  availability: TranscriptionProviderAvailability
  models: TranscriptionProviderModel[]
  validateBeforeTranscribe?: (
    context: ProviderReadinessContext
  ) => Promise<TranscriptionFailureCode | null> | TranscriptionFailureCode | null
  kind: 'local'
  isModelDownloaded: (modelId: string) => boolean
  transcribe?: (
    artifact: TranscriptionArtifact,
    context: LocalProviderTranscriptionContext
  ) => Promise<TranscriptionResult>
}
