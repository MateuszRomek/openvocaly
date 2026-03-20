import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { transcriptionKeys } from './transcription.keys'

type CancelLocalModelDownloadResponse = Awaited<
  ReturnType<Window['api']['transcription']['local']['cancelDownload']>
>
type CancelLocalModelDownloadMutationInput = Parameters<
  Window['api']['transcription']['local']['cancelDownload']
>[0]

export function useCancelLocalModelDownloadMutation(): UseMutationResult<
  CancelLocalModelDownloadResponse,
  Error,
  CancelLocalModelDownloadMutationInput
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ providerId }) => {
      const response = await window.api.transcription.local.cancelDownload({
        providerId
      })
      if (!response.ok) {
        throw new Error(response.message ?? 'Failed to cancel download.')
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
