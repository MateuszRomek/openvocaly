import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import type { UseSuspenseQueryOptions, UseSuspenseQueryResult } from '@tanstack/react-query'
import { homeReportingKeys } from './home-reporting.keys'
import type {
  HomeRecentSessionsQueryParams,
  HomeRecentSessionsResponse
} from './home-reporting.types'

type HomeRecentSessionsSuspenseQueryOptions = UseSuspenseQueryOptions<
  HomeRecentSessionsResponse,
  Error,
  HomeRecentSessionsResponse,
  ReturnType<typeof homeReportingKeys.recentSession>
>

export function homeRecentSessionsQueryOptions(
  params: HomeRecentSessionsQueryParams
): HomeRecentSessionsSuspenseQueryOptions {
  return queryOptions({
    queryKey: homeReportingKeys.recentSession(params),
    queryFn: async () => window.api.reporting.getHomeRecentSessions(params),
    staleTime: 60_000
  })
}

export function useHomeRecentSessionsSuspenseQuery(
  params: HomeRecentSessionsQueryParams,
  options?: Omit<HomeRecentSessionsSuspenseQueryOptions, 'queryKey' | 'queryFn' | 'staleTime'>
): UseSuspenseQueryResult<HomeRecentSessionsResponse> {
  return useSuspenseQuery({
    ...homeRecentSessionsQueryOptions(params),
    ...options
  })
}
