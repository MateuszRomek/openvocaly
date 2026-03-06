import { queryOptions, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import type { TranscriptionProviderId } from '../../hooks/use-transcription-provider-catalog'
import { transcriptionKeys } from './transcription.keys'

type LocalRuntimeStatusResponse = Awaited<
  ReturnType<typeof window.api.transcription.local.getRuntimeStatus>
>

type LocalRuntimeStatusQueryOptions = UseQueryOptions<
  LocalRuntimeStatusResponse,
  Error,
  LocalRuntimeStatusResponse,
  ReturnType<typeof transcriptionKeys.localRuntimeStatus>
>

export function localRuntimeStatusQueryOptions(
  providerId: TranscriptionProviderId
): LocalRuntimeStatusQueryOptions {
  return queryOptions({
    queryKey: transcriptionKeys.localRuntimeStatus(providerId),
    queryFn: async () => window.api.transcription.local.getRuntimeStatus()
  })
}

export function useLocalRuntimeStatusQuery(
  providerId: TranscriptionProviderId,
  options?: Omit<LocalRuntimeStatusQueryOptions, 'queryKey' | 'queryFn'>
): UseQueryResult<LocalRuntimeStatusResponse> {
  return useQuery({
    ...localRuntimeStatusQueryOptions(providerId),
    ...options
  })
}
