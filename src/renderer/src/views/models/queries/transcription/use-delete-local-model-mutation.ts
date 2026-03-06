import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import type { TranscriptionProviderId } from '../../hooks/use-transcription-provider-catalog'
import { transcriptionKeys } from './transcription.keys'

type DeleteLocalModelInput = Parameters<Window['api']['transcription']['local']['deleteModel']>[0]
type DeleteLocalModelResponse = Awaited<
  ReturnType<Window['api']['transcription']['local']['deleteModel']>
>
type DeleteLocalModelMutationInput = DeleteLocalModelInput & {
  providerId: TranscriptionProviderId
}

export function useDeleteLocalModelMutation(): UseMutationResult<
  DeleteLocalModelResponse,
  Error,
  DeleteLocalModelMutationInput
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DeleteLocalModelMutationInput) => {
      const response = await window.api.transcription.local.deleteModel({ modelId: input.modelId })
      if (!response.ok) {
        throw new Error(response.message ?? 'Failed to delete local model.')
      }
      return response
    },
    onSettled: async (_, __, variables) => {
      if (!variables) {
        return
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: transcriptionKeys.localModels(variables.providerId)
        }),
        queryClient.invalidateQueries({
          queryKey: transcriptionKeys.localRuntimeStatus(variables.providerId)
        }),
        queryClient.invalidateQueries({ queryKey: transcriptionKeys.preferences() })
      ])
    }
  })
}
