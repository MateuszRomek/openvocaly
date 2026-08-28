import type { TranscriptionProviderId } from '../hooks/use-transcription-provider-catalog'
import type { LocalTranscriptionProviderId } from '../../../../../shared/local-transcription'

export const LOCAL_PARAKEET_PROVIDER_ID = 'local-parakeet' as const
export const LOCAL_WHISPER_PROVIDER_ID = 'local-whisper' as const
export const LOCAL_QWEN_PROVIDER_ID = 'local-qwen' as const

const LOCAL_PROVIDER_CAPABILITIES: Record<
  LocalTranscriptionProviderId,
  { supportsLocalRuntimeActions: true }
> = {
  [LOCAL_PARAKEET_PROVIDER_ID]: {
    supportsLocalRuntimeActions: true
  },
  [LOCAL_WHISPER_PROVIDER_ID]: {
    supportsLocalRuntimeActions: true
  },
  [LOCAL_QWEN_PROVIDER_ID]: {
    supportsLocalRuntimeActions: true
  }
}

export const supportsLocalRuntimeActions = (
  providerId: TranscriptionProviderId
): providerId is LocalTranscriptionProviderId => {
  return providerId in LOCAL_PROVIDER_CAPABILITIES
}
