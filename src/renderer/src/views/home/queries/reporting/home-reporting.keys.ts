import type { HomeSummaryQueryParams } from './home-reporting.types'

const resolveAsOfKey = (asOfMs?: number): number | 'latest' => asOfMs ?? 'latest'

export const homeReportingKeys = {
  all: ['reporting', 'home'] as const,
  summaries: () => [...homeReportingKeys.all, 'summary'] as const,
  summary: ({ range, asOfMs }: HomeSummaryQueryParams) =>
    [...homeReportingKeys.summaries(), range, resolveAsOfKey(asOfMs)] as const
}
