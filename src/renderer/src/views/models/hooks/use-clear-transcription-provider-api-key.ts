import { useCallback } from 'react'
import { useClearProviderApiKeyMutation } from '@renderer/queries/transcription/use-clear-provider-api-key-mutation'
import type { TranscriptionProviderApiKeyMutationResponse } from '@renderer/queries/transcription/transcription.types'
import type { TranscriptionProviderId } from './use-transcription-provider-catalog'

type UseClearTranscriptionProviderApiKeyResult = {
  isPending: boolean
  isError: boolean
  clear: (
    providerId: TranscriptionProviderId
  ) => Promise<TranscriptionProviderApiKeyMutationResponse>
}

export function useClearTranscriptionProviderApiKey(): UseClearTranscriptionProviderApiKeyResult {
  const clearProviderApiKeyMutation = useClearProviderApiKeyMutation()

  const clear = useCallback(
    async (
      providerId: TranscriptionProviderId
    ): Promise<TranscriptionProviderApiKeyMutationResponse> => {
      return clearProviderApiKeyMutation.mutateAsync({
        providerId
      })
    },
    [clearProviderApiKeyMutation]
  )

  return {
    isPending: clearProviderApiKeyMutation.isPending,
    isError: clearProviderApiKeyMutation.isError,
    clear
  }
}
