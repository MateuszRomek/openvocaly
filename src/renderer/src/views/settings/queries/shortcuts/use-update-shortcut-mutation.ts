import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ShortcutUpdateInput } from './shortcuts.types'
import type {
  UpdateShortcutMutationResult,
  UpdateShortcutOptions
} from './use-shortcut-mutations.types'
import { shortcutsKeys } from './shortcuts.keys'

export function useUpdateShortcutMutation(
  options?: UpdateShortcutOptions
): UpdateShortcutMutationResult {
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (input: ShortcutUpdateInput) => window.api.shortcuts.update(input),
    onSuccess: async (response, variables, ...rest) => {
      if (response.ok) {
        await queryClient.invalidateQueries({ queryKey: shortcutsKeys.config() })
      }

      if (options?.onSuccess) {
        await options.onSuccess(response, variables, ...rest)
      }
    }
  })
}
