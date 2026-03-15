import { format, isValid, parseISO } from 'date-fns'
import type { HomeReportingRange } from '../constants/reporting-range'

function formatTimelineLabel(key: string, range: HomeReportingRange): string {
  const parsedDate = range === '12m' ? parseISO(`${key}-01`) : parseISO(key)

  if (!isValid(parsedDate)) {
    return key
  }

  if (range === '12m') {
    return format(parsedDate, 'MM/yy')
  }

  return format(parsedDate, 'MM/dd')
}

export function formatDailyOutputLabel(key: string, range: HomeReportingRange): string {
  return formatTimelineLabel(key, range)
}

export function formatMonthlyOutputLabel(key: string): string {
  const parsedDate = parseISO(`${key}-01`)

  if (!isValid(parsedDate)) {
    return key
  }

  return format(parsedDate, 'MMM')
}
