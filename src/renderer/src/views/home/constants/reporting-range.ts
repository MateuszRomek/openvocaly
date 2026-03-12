export type HomeReportingRange = Parameters<
  Window['api']['reporting']['getHomeSummary']
>[0]['range']

export const HOME_REPORTING_RANGE_VALUES = [
  '7d',
  '30d',
  '90d',
  '12m'
] as const satisfies readonly HomeReportingRange[]

export const DEFAULT_HOME_REPORTING_RANGE: HomeReportingRange = '30d'

export const HOME_REPORTING_RANGE_LABELS: Record<HomeReportingRange, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  '12m': '12 months'
}

export const isHomeReportingRange = (value: string): value is HomeReportingRange =>
  HOME_REPORTING_RANGE_VALUES.includes(value as HomeReportingRange)
