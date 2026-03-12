import type { HomeReportingRange } from '../constants/reporting-range'

export function formatDailyOutputLabel(key: string, range: HomeReportingRange): string {
  const segments = key.split('-')

  if (range === '12m' && segments.length === 2) {
    const [year, month] = segments
    return `${month}/${year.slice(-2)}`
  }

  if (segments.length === 3) {
    const [, month, day] = segments
    return `${month}/${day}`
  }

  return key
}
