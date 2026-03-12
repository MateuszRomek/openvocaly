import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import type { UseSuspenseQueryOptions, UseSuspenseQueryResult } from '@tanstack/react-query'
import { HOME_REPORTING_QUERY_STALE_TIME_MS } from '../../constants/reporting-query'
import { homeReportingKeys } from './home-reporting.keys'
import type { HomeAppsQueryParams, HomeAppsResponse } from './home-reporting.types'

type HomeAppsSuspenseQueryOptions = UseSuspenseQueryOptions<
  HomeAppsResponse,
  Error,
  HomeAppsResponse,
  ReturnType<typeof homeReportingKeys.app>
>

export function homeAppsQueryOptions(params: HomeAppsQueryParams): HomeAppsSuspenseQueryOptions {
  return queryOptions({
    queryKey: homeReportingKeys.app(params),
    queryFn: async () => window.api.reporting.getHomeApps(params),
    staleTime: HOME_REPORTING_QUERY_STALE_TIME_MS,
    refetchOnMount: 'always'
  })
}

export function useHomeAppsSuspenseQuery(
  params: HomeAppsQueryParams,
  options?: Omit<HomeAppsSuspenseQueryOptions, 'queryKey' | 'queryFn' | 'staleTime'>
): UseSuspenseQueryResult<HomeAppsResponse> {
  return useSuspenseQuery({
    ...homeAppsQueryOptions(params),
    ...options
  })
}
