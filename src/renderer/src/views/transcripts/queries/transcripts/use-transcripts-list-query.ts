import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { TRANSCRIPTS_QUERY_STALE_TIME_MS } from '../../constants/transcripts'
import { transcriptsKeys } from './transcripts.keys'
import type { TranscriptsListResponse } from './transcripts.types'

type TranscriptsListQueryOptions = UseQueryOptions<
  TranscriptsListResponse,
  Error,
  TranscriptsListResponse,
  ReturnType<typeof transcriptsKeys.list>
>

export function transcriptsListQueryOptions(page: number): TranscriptsListQueryOptions {
  return queryOptions({
    queryKey: transcriptsKeys.list(page),
    queryFn: async () => await window.api.storage.listTranscripts({ page }),
    staleTime: TRANSCRIPTS_QUERY_STALE_TIME_MS,
    placeholderData: keepPreviousData
  })
}

export function useTranscriptsListQuery(
  page: number,
  options?: Omit<
    TranscriptsListQueryOptions,
    'queryKey' | 'queryFn' | 'staleTime' | 'placeholderData'
  >
): UseQueryResult<TranscriptsListResponse> {
  return useQuery({
    ...transcriptsListQueryOptions(page),
    ...options
  })
}
