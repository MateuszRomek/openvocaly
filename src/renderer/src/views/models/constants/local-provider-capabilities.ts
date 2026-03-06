import type { TranscriptionProviderId } from '../hooks/use-transcription-provider-catalog'

export const LOCAL_PARAKEET_PROVIDER_ID = 'local-parakeet' as const

const LOCAL_PROVIDER_CAPABILITIES: Partial<
  Record<TranscriptionProviderId, { supportsLocalRuntimeActions: boolean }>
> = {
  [LOCAL_PARAKEET_PROVIDER_ID]: {
    supportsLocalRuntimeActions: true
  }
}

export const supportsLocalRuntimeActions = (providerId: TranscriptionProviderId): boolean => {
  return LOCAL_PROVIDER_CAPABILITIES[providerId]?.supportsLocalRuntimeActions ?? false
}
