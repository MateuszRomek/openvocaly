import { queryOptions, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { recordingKeys } from './recording.keys'
import type { RecordingPreferencesResponse } from './recording.types'

type RecordingPreferencesQueryOptions = UseQueryOptions<
  RecordingPreferencesResponse,
  Error,
  RecordingPreferencesResponse,
  ReturnType<typeof recordingKeys.preferences>
>

export function recordingPreferencesQueryOptions(): RecordingPreferencesQueryOptions {
  return queryOptions({
    queryKey: recordingKeys.preferences(),
    queryFn: async () => window.api.recording.getPreferences()
  })
}

export function useRecordingPreferencesQuery(
  options?: Omit<RecordingPreferencesQueryOptions, 'queryKey' | 'queryFn'>
): UseQueryResult<RecordingPreferencesResponse> {
  return useQuery({
    ...recordingPreferencesQueryOptions(),
    ...options
  })
}
