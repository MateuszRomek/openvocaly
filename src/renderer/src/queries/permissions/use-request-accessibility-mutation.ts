import { useMutation, useQueryClient } from '@tanstack/react-query'
import { permissionsKeys } from './permissions.keys'
import type {
  RequestAccessibilityMutationResult,
  RequestAccessibilityOptions
} from './use-permissions-mutations.types'

export function useRequestAccessibilityMutation(
  options?: RequestAccessibilityOptions
): RequestAccessibilityMutationResult {
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async () => window.api.permissions.requestAccessibility(),
    onSuccess: async (response, variables, ...rest) => {
      await queryClient.invalidateQueries({ queryKey: permissionsKeys.status() })

      if (options?.onSuccess) {
        await options.onSuccess(response, variables, ...rest)
      }
    }
  })
}
