import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import type { UseSuspenseQueryOptions, UseSuspenseQueryResult } from '@tanstack/react-query'
import { HOME_REPORTING_QUERY_STALE_TIME_MS } from '../../constants/reporting-query'
import { homeReportingKeys } from './home-reporting.keys'
import type {
  HomeRangeTimelinesQueryParams,
  HomeRangeTimelinesResponse
} from './home-reporting.types'

type HomeRangeTimelinesSuspenseQueryOptions = UseSuspenseQueryOptions<
  HomeRangeTimelinesResponse,
  Error,
  HomeRangeTimelinesResponse,
  ReturnType<typeof homeReportingKeys.timeline>
>

export function homeRangeTimelinesQueryOptions(
  params: HomeRangeTimelinesQueryParams
): HomeRangeTimelinesSuspenseQueryOptions {
  return queryOptions({
    queryKey: homeReportingKeys.timeline(params),
    queryFn: async () => window.api.reporting.getHomeRangeTimelines(params),
    staleTime: HOME_REPORTING_QUERY_STALE_TIME_MS,
    refetchOnMount: 'always'
  })
}

export function useHomeRangeTimelinesSuspenseQuery(
  params: HomeRangeTimelinesQueryParams,
  options?: Omit<HomeRangeTimelinesSuspenseQueryOptions, 'queryKey' | 'queryFn' | 'staleTime'>
): UseSuspenseQueryResult<HomeRangeTimelinesResponse> {
  return useSuspenseQuery({
    ...homeRangeTimelinesQueryOptions(params),
    ...options
  })
}
