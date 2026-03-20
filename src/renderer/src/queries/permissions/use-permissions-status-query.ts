import { queryOptions, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { permissionsKeys } from './permissions.keys'
import type { PermissionsStatusResponse } from './permissions.types'

type PermissionsStatusQueryOptions = UseQueryOptions<
  PermissionsStatusResponse,
  Error,
  PermissionsStatusResponse,
  ReturnType<typeof permissionsKeys.status>
>

export function permissionsStatusQueryOptions(): PermissionsStatusQueryOptions {
  return queryOptions({
    queryKey: permissionsKeys.status(),
    queryFn: async () => window.api.permissions.getStatus(),
    staleTime: 0
  })
}

export function usePermissionsStatusQuery(
  options?: Omit<PermissionsStatusQueryOptions, 'queryKey' | 'queryFn'>
): UseQueryResult<PermissionsStatusResponse> {
  return useQuery({
    ...permissionsStatusQueryOptions(),
    ...options
  })
}
