import { useMutation, useQueryClient } from '@tanstack/react-query'
import { permissionsKeys } from './permissions.keys'
import type {
  RequestMicrophoneMutationResult,
  RequestMicrophoneOptions
} from './use-permissions-mutations.types'

export function useRequestMicrophoneMutation(
  options?: RequestMicrophoneOptions
): RequestMicrophoneMutationResult {
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async () => window.api.permissions.requestMicrophone(),
    onSuccess: async (response, variables, ...rest) => {
      await queryClient.invalidateQueries({ queryKey: permissionsKeys.status() })

      if (options?.onSuccess) {
        await options.onSuccess(response, variables, ...rest)
      }
    }
  })
}
