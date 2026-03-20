import { useCallback } from 'react'
import { useSetProviderApiKeyMutation } from '@renderer/queries/transcription/use-set-provider-api-key-mutation'
import type { TranscriptionProviderApiKeyMutationResponse } from '@renderer/queries/transcription/transcription.types'
import type { TranscriptionProviderId } from './use-transcription-provider-catalog'

type UseSaveTranscriptionProviderApiKeyResult = {
  isPending: boolean
  isError: boolean
  save: (
    providerId: TranscriptionProviderId,
    apiKey: string
  ) => Promise<TranscriptionProviderApiKeyMutationResponse>
}

export function useSaveTranscriptionProviderApiKey(): UseSaveTranscriptionProviderApiKeyResult {
  const setProviderApiKeyMutation = useSetProviderApiKeyMutation()

  const save = useCallback(
    async (
      providerId: TranscriptionProviderId,
      apiKey: string
    ): Promise<TranscriptionProviderApiKeyMutationResponse> => {
      return setProviderApiKeyMutation.mutateAsync({
        providerId,
        apiKey
      })
    },
    [setProviderApiKeyMutation]
  )

  return {
    isPending: setProviderApiKeyMutation.isPending,
    isError: setProviderApiKeyMutation.isError,
    save
  }
}
