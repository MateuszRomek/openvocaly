export type HomeSummaryResponse = Awaited<ReturnType<typeof window.api.reporting.getHomeSummary>>

export type HomeSummaryQueryParams = Parameters<Window['api']['reporting']['getHomeSummary']>[0]
