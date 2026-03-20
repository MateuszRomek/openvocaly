import { useMutation, useQueryClient } from '@tanstack/react-query'
import { permissionsKeys } from './permissions.keys'
import type {
  OpenAccessibilitySettingsMutationResult,
  OpenAccessibilitySettingsOptions
} from './use-permissions-mutations.types'

export function useOpenAccessibilitySettingsMutation(
  options?: OpenAccessibilitySettingsOptions
): OpenAccessibilitySettingsMutationResult {
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async () => window.api.permissions.openAccessibilitySettings(),
    onSuccess: async (response, variables, ...rest) => {
      if (response.ok) {
        await queryClient.invalidateQueries({ queryKey: permissionsKeys.status() })
      }

      if (options?.onSuccess) {
        await options.onSuccess(response, variables, ...rest)
      }
    }
  })
}
