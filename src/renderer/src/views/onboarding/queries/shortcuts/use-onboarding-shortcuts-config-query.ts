import { queryOptions, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import type { ShortcutConfigResponse } from '../../../../../../shared/shortcuts'
import { onboardingShortcutsKeys } from './onboarding-shortcuts.keys'

type OnboardingShortcutsConfigQueryOptions = UseQueryOptions<
  ShortcutConfigResponse,
  Error,
  ShortcutConfigResponse,
  ReturnType<typeof onboardingShortcutsKeys.config>
>

export function onboardingShortcutsConfigQueryOptions(): OnboardingShortcutsConfigQueryOptions {
  return queryOptions({
    queryKey: onboardingShortcutsKeys.config(),
    queryFn: async () => window.api.shortcuts.getConfig()
  })
}

export function useOnboardingShortcutsConfigQuery(
  options?: Omit<OnboardingShortcutsConfigQueryOptions, 'queryKey' | 'queryFn'>
): UseQueryResult<ShortcutConfigResponse> {
  return useQuery({
    ...onboardingShortcutsConfigQueryOptions(),
    ...options
  })
}
