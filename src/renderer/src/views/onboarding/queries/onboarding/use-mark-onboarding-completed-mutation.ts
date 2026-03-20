import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import type { OnboardingMarkCompletedResponse } from '../../../../../../shared/onboarding'
import { onboardingKeys } from './onboarding.keys'

export function useMarkOnboardingCompletedMutation(): UseMutationResult<
  OnboardingMarkCompletedResponse,
  Error,
  void
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => window.api.onboarding.markCompleted(),
    onSuccess: (response) => {
      queryClient.setQueryData(onboardingKeys.state(), {
        state: response.state
      })
    }
  })
}
