import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { transcriptionKeys } from './transcription.keys'
import type {
  TranscriptionProviderApiKeyMutationResponse,
  TranscriptionProviderApiKeyUpdateInput
} from './transcription.types'

export function useSetProviderApiKeyMutation(): UseMutationResult<
  TranscriptionProviderApiKeyMutationResponse,
  Error,
  TranscriptionProviderApiKeyUpdateInput
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: TranscriptionProviderApiKeyUpdateInput) =>
      window.api.transcription.cloud.setProviderApiKey(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: transcriptionKeys.preferences() })
    }
  })
}
