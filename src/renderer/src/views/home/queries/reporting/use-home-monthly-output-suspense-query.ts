import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import type { UseSuspenseQueryOptions, UseSuspenseQueryResult } from '@tanstack/react-query'
import { HOME_REPORTING_QUERY_STALE_TIME_MS } from '../../constants/reporting-query'
import { homeReportingKeys } from './home-reporting.keys'
import type {
  HomeMonthlyOutputQueryParams,
  HomeMonthlyOutputResponse
} from './home-reporting.types'

type HomeMonthlyOutputSuspenseQueryOptions = UseSuspenseQueryOptions<
  HomeMonthlyOutputResponse,
  Error,
  HomeMonthlyOutputResponse,
  ReturnType<typeof homeReportingKeys.monthly>
>

export function homeMonthlyOutputQueryOptions(
  params: HomeMonthlyOutputQueryParams
): HomeMonthlyOutputSuspenseQueryOptions {
  return queryOptions({
    queryKey: homeReportingKeys.monthly(params),
    queryFn: async () => window.api.reporting.getHomeMonthlyOutput(params),
    staleTime: HOME_REPORTING_QUERY_STALE_TIME_MS,
    refetchOnMount: 'always'
  })
}

export function useHomeMonthlyOutputSuspenseQuery(
  params: HomeMonthlyOutputQueryParams,
  options?: Omit<HomeMonthlyOutputSuspenseQueryOptions, 'queryKey' | 'queryFn' | 'staleTime'>
): UseSuspenseQueryResult<HomeMonthlyOutputResponse> {
  return useSuspenseQuery({
    ...homeMonthlyOutputQueryOptions(params),
    ...options
  })
}
