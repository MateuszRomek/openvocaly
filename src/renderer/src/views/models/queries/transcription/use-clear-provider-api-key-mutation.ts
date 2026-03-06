import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { transcriptionKeys } from './transcription.keys'
import type { TranscriptionProviderApiKeyMutationResponse } from './transcription.types'

type ClearProviderApiKeyInput = {
  providerId: Parameters<Window['api']['transcription']['cloud']['clearProviderApiKey']>[0]['providerId']
}

export function useClearProviderApiKeyMutation(): UseMutationResult<
  TranscriptionProviderApiKeyMutationResponse,
  Error,
  ClearProviderApiKeyInput
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ClearProviderApiKeyInput) =>
      window.api.transcription.cloud.clearProviderApiKey(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: transcriptionKeys.preferences() })
    }
  })
}
