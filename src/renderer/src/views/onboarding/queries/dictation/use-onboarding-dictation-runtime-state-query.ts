import { queryOptions, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import type { DictationRuntimeStateResponse } from '../../../../../../shared/dictation'
import { onboardingDictationKeys } from './onboarding-dictation.keys'

type OnboardingDictationRuntimeStateQueryOptions = UseQueryOptions<
  DictationRuntimeStateResponse,
  Error,
  DictationRuntimeStateResponse,
  ReturnType<typeof onboardingDictationKeys.runtimeState>
>

export function onboardingDictationRuntimeStateQueryOptions(): OnboardingDictationRuntimeStateQueryOptions {
  return queryOptions({
    queryKey: onboardingDictationKeys.runtimeState(),
    queryFn: async () => window.api.dictation.getRuntimeState()
  })
}

export function useOnboardingDictationRuntimeStateQuery(
  options?: Omit<OnboardingDictationRuntimeStateQueryOptions, 'queryKey' | 'queryFn'>
): UseQueryResult<DictationRuntimeStateResponse> {
  return useQuery({
    ...onboardingDictationRuntimeStateQueryOptions(),
    ...options
  })
}
