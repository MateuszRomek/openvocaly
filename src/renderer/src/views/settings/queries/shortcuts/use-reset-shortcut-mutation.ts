import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ShortcutResetInput } from './shortcuts.types'
import type {
  ResetShortcutMutationResult,
  ResetShortcutOptions
} from './use-shortcut-mutations.types'
import { shortcutsKeys } from './shortcuts.keys'

export function useResetShortcutMutation(
  options?: ResetShortcutOptions
): ResetShortcutMutationResult {
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (input?: ShortcutResetInput) => window.api.shortcuts.reset(input),
    onSuccess: async (response, variables, ...rest) => {
      if (response.ok) {
        await queryClient.invalidateQueries({ queryKey: shortcutsKeys.config() })
        await queryClient.invalidateQueries({ queryKey: shortcutsKeys.runtimeStatus() })
      }

      if (options?.onSuccess) {
        await options.onSuccess(response, variables, ...rest)
      }
    }
  })
}
