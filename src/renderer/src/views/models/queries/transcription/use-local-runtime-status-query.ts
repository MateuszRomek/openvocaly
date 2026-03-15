import { queryOptions, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { transcriptionKeys } from './transcription.keys'

type LocalRuntimeStatusResponse = Awaited<
  ReturnType<typeof window.api.transcription.local.getRuntimeStatus>
>
type LocalProviderId = Parameters<
  Window['api']['transcription']['local']['getRuntimeStatus']
>[0]['providerId']

type LocalRuntimeStatusQueryOptions = UseQueryOptions<
  LocalRuntimeStatusResponse,
  Error,
  LocalRuntimeStatusResponse,
  ReturnType<typeof transcriptionKeys.localRuntimeStatus>
>

export function localRuntimeStatusQueryOptions(
  providerId: LocalProviderId
): LocalRuntimeStatusQueryOptions {
  return queryOptions({
    queryKey: transcriptionKeys.localRuntimeStatus(providerId),
    queryFn: async () =>
      window.api.transcription.local.getRuntimeStatus({
        providerId
      })
  })
}

export function useLocalRuntimeStatusQuery(
  providerId: LocalProviderId,
  options?: Omit<LocalRuntimeStatusQueryOptions, 'queryKey' | 'queryFn'>
): UseQueryResult<LocalRuntimeStatusResponse> {
  return useQuery({
    ...localRuntimeStatusQueryOptions(providerId),
    ...options
  })
}
