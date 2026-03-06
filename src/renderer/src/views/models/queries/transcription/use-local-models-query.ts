import { queryOptions, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import type { TranscriptionProviderId } from '../../hooks/use-transcription-provider-catalog'
import { transcriptionKeys } from './transcription.keys'

type LocalModelsResponse = Awaited<ReturnType<typeof window.api.transcription.local.listModels>>

type LocalModelsQueryOptions = UseQueryOptions<
  LocalModelsResponse,
  Error,
  LocalModelsResponse,
  ReturnType<typeof transcriptionKeys.localModels>
>

export function localModelsQueryOptions(providerId: TranscriptionProviderId): LocalModelsQueryOptions {
  return queryOptions({
    queryKey: transcriptionKeys.localModels(providerId),
    queryFn: async () => window.api.transcription.local.listModels()
  })
}

export function useLocalModelsQuery(
  providerId: TranscriptionProviderId,
  options?: Omit<LocalModelsQueryOptions, 'queryKey' | 'queryFn'>
): UseQueryResult<LocalModelsResponse> {
  return useQuery({
    ...localModelsQueryOptions(providerId),
    ...options
  })
}
