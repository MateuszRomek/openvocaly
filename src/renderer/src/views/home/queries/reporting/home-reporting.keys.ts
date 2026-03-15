import type {
  HomeAppsQueryParams,
  HomeMonthlyOutputQueryParams,
  HomeRangeTimelinesQueryParams,
  HomeSummaryQueryParams
} from './home-reporting.types'

const resolveAsOfKey = (asOfMs?: number): number | 'latest' => asOfMs ?? 'latest'
const resolveTopLimitKey = (topLimit?: number): number | 'default' => topLimit ?? 'default'

export const homeReportingKeys = {
  all: ['reporting', 'home'] as const,
  summaries: () => [...homeReportingKeys.all, 'summary'] as const,
  summary: ({ range, asOfMs }: HomeSummaryQueryParams) =>
    [...homeReportingKeys.summaries(), range, resolveAsOfKey(asOfMs)] as const,
  timelines: () => [...homeReportingKeys.all, 'timelines'] as const,
  timeline: ({ range, asOfMs }: HomeRangeTimelinesQueryParams) =>
    [...homeReportingKeys.timelines(), range, resolveAsOfKey(asOfMs)] as const,
  monthlies: () => [...homeReportingKeys.all, 'monthly'] as const,
  monthly: ({ asOfMs }: HomeMonthlyOutputQueryParams) =>
    [...homeReportingKeys.monthlies(), resolveAsOfKey(asOfMs)] as const,
  apps: () => [...homeReportingKeys.all, 'apps'] as const,
  app: ({ range, asOfMs, topLimit }: HomeAppsQueryParams) =>
    [
      ...homeReportingKeys.apps(),
      range,
      resolveAsOfKey(asOfMs),
      resolveTopLimitKey(topLimit)
    ] as const
}
