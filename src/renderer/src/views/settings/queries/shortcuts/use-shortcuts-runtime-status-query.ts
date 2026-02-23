import { queryOptions, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import type { ShortcutRuntimeStatusResponse } from './shortcuts.types'
import { shortcutsKeys } from './shortcuts.keys'

type ShortcutsRuntimeStatusQueryOptions = UseQueryOptions<
  ShortcutRuntimeStatusResponse,
  Error,
  ShortcutRuntimeStatusResponse,
  ReturnType<typeof shortcutsKeys.runtimeStatus>
>

export function shortcutsRuntimeStatusQueryOptions(): ShortcutsRuntimeStatusQueryOptions {
  return queryOptions({
    queryKey: shortcutsKeys.runtimeStatus(),
    queryFn: async () => window.api.shortcuts.getRuntimeStatus(),
    staleTime: 0
  })
}

export function useShortcutsRuntimeStatusQuery(
  options?: Omit<ShortcutsRuntimeStatusQueryOptions, 'queryKey' | 'queryFn'>
): UseQueryResult<ShortcutRuntimeStatusResponse> {
  return useQuery({
    ...shortcutsRuntimeStatusQueryOptions(),
    ...options
  })
}
