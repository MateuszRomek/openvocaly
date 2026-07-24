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

export type CloudProviderTranscriptionContext = {
  apiKey: string
  modelId: string
}

export type LocalProviderTranscriptionContext = {
  modelId: string
}

export type ProviderReadinessContext = {
  modelId: string
}

type BaseTranscriptionProviderDefinition = {
  id: TranscriptionProviderId
  label: string
  availability: TranscriptionProviderAvailability
  models: TranscriptionProviderModel[]
  isConfigured?: (context: ProviderReadinessContext) => boolean
  validateBeforeTranscribe?: (
    context: ProviderReadinessContext
  ) => Promise<TranscriptionFailureCode | null> | TranscriptionFailureCode | null
}

export type CloudProviderDefinition = BaseTranscriptionProviderDefinition & {
  kind: 'cloud'
  transcribe?: (
    artifact: TranscriptionArtifact,
    context: CloudProviderTranscriptionContext
  ) => Promise<TranscriptionResult>
}

export type LocalProviderDefinition = BaseTranscriptionProviderDefinition & {
  kind: 'local'
  isModelDownloaded: (modelId: string) => boolean
  transcribe?: (
    artifact: TranscriptionArtifact,
    context: LocalProviderTranscriptionContext
  ) => Promise<TranscriptionResult>
}

export type TranscriptionProviderDefinition = CloudProviderDefinition | LocalProviderDefinition
