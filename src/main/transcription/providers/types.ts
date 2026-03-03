import type { RecordingArtifact } from '../../../shared/recording'
import type {
  TranscriptionProviderAvailability,
  TranscriptionProviderId,
  TranscriptionResult
} from '../../../shared/transcription'

export type ProviderTranscriptionContext = {
  apiKey: string
  modelId: string
}

export type TranscriptionProviderDefinition = {
  id: TranscriptionProviderId
  label: string
  availability: TranscriptionProviderAvailability
  models: Array<{ id: string; label: string }>
  transcribe?: (
    artifact: RecordingArtifact,
    context: ProviderTranscriptionContext
  ) => Promise<TranscriptionResult>
}
