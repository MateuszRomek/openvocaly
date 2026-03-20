import { useMutation, useQueryClient } from '@tanstack/react-query'
import { permissionsKeys } from './permissions.keys'
import type {
  OpenMicrophoneSettingsMutationResult,
  OpenMicrophoneSettingsOptions
} from './use-permissions-mutations.types'

export function useOpenMicrophoneSettingsMutation(
  options?: OpenMicrophoneSettingsOptions
): OpenMicrophoneSettingsMutationResult {
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async () => window.api.permissions.openMicrophoneSettings(),
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
