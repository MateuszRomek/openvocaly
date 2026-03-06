import type { RecordingArtifact } from '../../../shared/recording'
import type {
  TranscriptionFailureCode,
  TranscriptionProviderAvailability,
  TranscriptionProviderId,
  TranscriptionProviderModel,
  TranscriptionResult
} from '../../../shared/transcription'

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
    artifact: RecordingArtifact,
    context: CloudProviderTranscriptionContext
  ) => Promise<TranscriptionResult>
}

export type LocalProviderDefinition = BaseTranscriptionProviderDefinition & {
  kind: 'local'
  isModelDownloaded: (modelId: string) => boolean
  transcribe?: (
    artifact: RecordingArtifact,
    context: LocalProviderTranscriptionContext
  ) => Promise<TranscriptionResult>
}

export type TranscriptionProviderDefinition = CloudProviderDefinition | LocalProviderDefinition
