import type { HomeReportingRange } from '../constants/reporting-range'

function formatTimelineLabel(key: string, range: HomeReportingRange): string {
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

export function formatDailyOutputLabel(key: string, range: HomeReportingRange): string {
  return formatTimelineLabel(key, range)
}

export function formatWpmTrendLabel(key: string, range: HomeReportingRange): string {
  return formatTimelineLabel(key, range)
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]

export function formatMonthlyOutputLabel(key: string): string {
  const segments = key.split('-')

  if (segments.length !== 2) {
    return key
  }

  const monthIndex = Number(segments[1]) - 1
  const monthLabel = MONTH_LABELS[monthIndex]

  return monthLabel ?? key
}
