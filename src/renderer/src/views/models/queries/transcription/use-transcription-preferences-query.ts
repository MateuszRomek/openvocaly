import { queryOptions, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { transcriptionKeys } from './transcription.keys'
import type { TranscriptionPreferencesResponse } from './transcription.types'

type TranscriptionPreferencesQueryOptions = UseQueryOptions<
  TranscriptionPreferencesResponse,
  Error,
  TranscriptionPreferencesResponse,
  ReturnType<typeof transcriptionKeys.preferences>
>

export function transcriptionPreferencesQueryOptions(): TranscriptionPreferencesQueryOptions {
  return queryOptions({
    queryKey: transcriptionKeys.preferences(),
    queryFn: async () => window.api.transcription.preferences.get()
  })
}

export function useTranscriptionPreferencesQuery(
  options?: Omit<TranscriptionPreferencesQueryOptions, 'queryKey' | 'queryFn'>
): UseQueryResult<TranscriptionPreferencesResponse> {
  return useQuery({
    ...transcriptionPreferencesQueryOptions(),
    ...options
  })
}
