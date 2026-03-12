export type HomeSummaryResponse = Awaited<ReturnType<typeof window.api.reporting.getHomeSummary>>

export type HomeSummaryQueryParams = Parameters<Window['api']['reporting']['getHomeSummary']>[0]

export type HomeRangeTimelinesResponse = Awaited<
  ReturnType<typeof window.api.reporting.getHomeRangeTimelines>
>

export type HomeRangeTimelinesQueryParams = Parameters<
  Window['api']['reporting']['getHomeRangeTimelines']
>[0]
