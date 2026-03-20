import { queryOptions, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import type { OnboardingStateResponse } from '../../../../../../shared/onboarding'
import { onboardingKeys } from './onboarding.keys'

type OnboardingStateQueryOptions = UseQueryOptions<
  OnboardingStateResponse,
  Error,
  OnboardingStateResponse,
  ReturnType<typeof onboardingKeys.state>
>

export function onboardingStateQueryOptions(): OnboardingStateQueryOptions {
  return queryOptions({
    queryKey: onboardingKeys.state(),
    queryFn: async () => window.api.onboarding.getState()
  })
}

export function useOnboardingStateQuery(
  options?: Omit<OnboardingStateQueryOptions, 'queryKey' | 'queryFn'>
): UseQueryResult<OnboardingStateResponse> {
  return useQuery({
    ...onboardingStateQueryOptions(),
    ...options
  })
}
