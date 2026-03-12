export type HomeSummaryResponse = Awaited<ReturnType<typeof window.api.reporting.getHomeSummary>>

export type HomeSummaryQueryParams = Parameters<Window['api']['reporting']['getHomeSummary']>[0]

export type HomeRangeTimelinesResponse = Awaited<
  ReturnType<typeof window.api.reporting.getHomeRangeTimelines>
>

export type HomeRangeTimelinesQueryParams = Parameters<
  Window['api']['reporting']['getHomeRangeTimelines']
>[0]

export type HomeMonthlyOutputResponse = Awaited<
  ReturnType<typeof window.api.reporting.getHomeMonthlyOutput>
>

export type HomeMonthlyOutputQueryParams = Parameters<
  Window['api']['reporting']['getHomeMonthlyOutput']
>[0]

export type HomeAppsResponse = Awaited<ReturnType<typeof window.api.reporting.getHomeApps>>

export type HomeAppsQueryParams = Parameters<Window['api']['reporting']['getHomeApps']>[0]

export type HomeRecentSessionsResponse = Awaited<
  ReturnType<typeof window.api.reporting.getHomeRecentSessions>
>

export type HomeRecentSessionsQueryParams = Parameters<
  Window['api']['reporting']['getHomeRecentSessions']
>[0]
