import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { transcriptionKeys } from './transcription.keys'

type DownloadLocalModelInput = Parameters<
  Window['api']['transcription']['local']['downloadModel']
>[0]
type DownloadLocalModelResponse = Awaited<
  ReturnType<Window['api']['transcription']['local']['downloadModel']>
>
type DownloadLocalModelMutationInput = DownloadLocalModelInput

export function useDownloadLocalModelMutation(): UseMutationResult<
  DownloadLocalModelResponse,
  Error,
  DownloadLocalModelMutationInput
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DownloadLocalModelMutationInput) => {
      const response = await window.api.transcription.local.downloadModel({
        providerId: input.providerId,
        modelId: input.modelId
      })
      if (!response.ok) {
        throw new Error(response.message ?? 'Failed to download local model.')
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
        })
      ])
    }
  })
}
