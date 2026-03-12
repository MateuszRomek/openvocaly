import type { ReportingRange } from '../../../shared/reporting'
import { subDays, subMonths } from 'date-fns'

const RANGE_SUBTRACTOR: Record<ReportingRange, (asOf: Date) => Date> = {
  '7d': (asOf) => subDays(asOf, 7),
  '30d': (asOf) => subDays(asOf, 30),
  '90d': (asOf) => subDays(asOf, 90),
  '12m': (asOf) => subMonths(asOf, 12)
}

export type ReportingWindow = {
  fromMs: number
  toMs: number
}

export const isReportingRange = (value: string): value is ReportingRange =>
  value === '7d' || value === '30d' || value === '90d' || value === '12m'

export const normalizeAsOfMs = (asOfMs?: number): number => {
  if (typeof asOfMs !== 'number' || Number.isNaN(asOfMs) || asOfMs <= 0) {
    return Date.now()
  }

  return Math.floor(asOfMs)
}

export const resolveSystemTimezone = (): string => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  if (timezone && timezone.trim().length > 0) {
    return timezone
  }

  return 'UTC'
}

const subtractRange = (range: ReportingRange, asOfMs: number): number =>
  RANGE_SUBTRACTOR[range](new Date(asOfMs)).getTime()

export const resolveCurrentWindow = (range: ReportingRange, asOfMs: number): ReportingWindow => ({
  fromMs: subtractRange(range, asOfMs),
  toMs: asOfMs
})

export const resolvePreviousWindow = (range: ReportingRange, asOfMs: number): ReportingWindow => {
  const currentFromMs = subtractRange(range, asOfMs)

  return {
    fromMs: subtractRange(range, currentFromMs),
    toMs: currentFromMs
  }
}

export const resolveTrailingMonthsWindow = (asOfMs: number, months: number): ReportingWindow => {
  const safeMonths = Number.isFinite(months) ? Math.max(1, Math.floor(months)) : 1

  return {
    fromMs: subMonths(new Date(asOfMs), safeMonths).getTime(),
    toMs: asOfMs
  }
}
