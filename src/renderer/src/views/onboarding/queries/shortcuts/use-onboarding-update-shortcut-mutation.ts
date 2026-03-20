import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import type {
  ShortcutMutationResponse,
  ShortcutUpdateInput
} from '../../../../../../shared/shortcuts'
import { onboardingShortcutsKeys } from './onboarding-shortcuts.keys'

export function useOnboardingUpdateShortcutMutation(): UseMutationResult<
  ShortcutMutationResponse,
  Error,
  ShortcutUpdateInput
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ShortcutUpdateInput) => window.api.shortcuts.update(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: onboardingShortcutsKeys.config() })
    }
  })
}
