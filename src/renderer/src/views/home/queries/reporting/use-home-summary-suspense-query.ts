import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import type { UseSuspenseQueryOptions, UseSuspenseQueryResult } from '@tanstack/react-query'
import { homeReportingKeys } from './home-reporting.keys'
import type { HomeSummaryQueryParams, HomeSummaryResponse } from './home-reporting.types'

type HomeSummarySuspenseQueryOptions = UseSuspenseQueryOptions<
  HomeSummaryResponse,
  Error,
  HomeSummaryResponse,
  ReturnType<typeof homeReportingKeys.summary>
>

export function homeSummaryQueryOptions(
  params: HomeSummaryQueryParams
): HomeSummarySuspenseQueryOptions {
  return queryOptions({
    queryKey: homeReportingKeys.summary(params),
    queryFn: async () => window.api.reporting.getHomeSummary(params),
    staleTime: 60_000
  })
}

export function useHomeSummarySuspenseQuery(
  params: HomeSummaryQueryParams,
  options?: Omit<HomeSummarySuspenseQueryOptions, 'queryKey' | 'queryFn' | 'staleTime'>
): UseSuspenseQueryResult<HomeSummaryResponse> {
  return useSuspenseQuery({
    ...homeSummaryQueryOptions(params),
    ...options
  })
}
