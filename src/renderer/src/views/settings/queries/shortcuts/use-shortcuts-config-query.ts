import { queryOptions, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import type { ShortcutConfigResponse } from './shortcuts.types'
import { shortcutsKeys } from './shortcuts.keys'

type ShortcutsConfigQueryOptions = UseQueryOptions<
  ShortcutConfigResponse,
  Error,
  ShortcutConfigResponse,
  ReturnType<typeof shortcutsKeys.config>
>

export function shortcutsConfigQueryOptions(): ShortcutsConfigQueryOptions {
  return queryOptions({
    queryKey: shortcutsKeys.config(),
    queryFn: async () => window.api.shortcuts.getConfig()
  })
}

export function useShortcutsConfigQuery(
  options?: Omit<ShortcutsConfigQueryOptions, 'queryKey' | 'queryFn'>
): UseQueryResult<ShortcutConfigResponse> {
  return useQuery({
    ...shortcutsConfigQueryOptions(),
    ...options
  })
}
