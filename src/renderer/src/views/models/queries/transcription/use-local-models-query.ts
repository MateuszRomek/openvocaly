import { queryOptions, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { transcriptionKeys } from './transcription.keys'

type LocalModelsResponse = Awaited<ReturnType<typeof window.api.transcription.local.listModels>>
type LocalProviderId = Parameters<
  Window['api']['transcription']['local']['listModels']
>[0]['providerId']

type LocalModelsQueryOptions = UseQueryOptions<
  LocalModelsResponse,
  Error,
  LocalModelsResponse,
  ReturnType<typeof transcriptionKeys.localModels>
>

export function localModelsQueryOptions(providerId: LocalProviderId): LocalModelsQueryOptions {
  return queryOptions({
    queryKey: transcriptionKeys.localModels(providerId),
    queryFn: async () =>
      window.api.transcription.local.listModels({
        providerId
      })
  })
}

export function useLocalModelsQuery(
  providerId: LocalProviderId,
  options?: Omit<LocalModelsQueryOptions, 'queryKey' | 'queryFn'>
): UseQueryResult<LocalModelsResponse> {
  return useQuery({
    ...localModelsQueryOptions(providerId),
    ...options
  })
}
