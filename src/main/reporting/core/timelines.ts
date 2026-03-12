import type {
  GetHomeMonthlyOutputResponse,
  ReportingMonthlyOutputPoint,
  ReportingRange,
  ReportingWordsTimelinePoint,
  ReportingWpmTimelinePoint
} from '../../../shared/reporting'
import { tz } from '@date-fns/tz'
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek
} from 'date-fns'
import type { ReportingSessionMetric } from '../types'

type BucketMode = 'day' | 'week' | 'month'

const RANGE_BUCKET_MODE: Record<ReportingRange, BucketMode> = {
  '7d': 'day',
  '30d': 'day',
  '90d': 'week',
  '12m': 'month'
}

const RANGE_BUCKET_COUNT: Record<ReportingRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 13,
  '12m': 12
}

type TimelineBucket = Pick<ReportingWordsTimelinePoint, 'key' | 'bucketStartMs' | 'bucketEndMs'>

const roundTo = (value: number, precision: number): number => {
  const multiplier = 10 ** precision
  return Math.round(value * multiplier) / multiplier
}

const buildTimelineBucket = (
  range: ReportingRange,
  startDate: Date,
  timezone: string
): TimelineBucket => {
  const inTimezone = { in: tz(timezone) }
  const mode = RANGE_BUCKET_MODE[range]

  if (mode === 'month') {
    return {
      key: format(startDate, 'yyyy-MM', inTimezone),
      bucketStartMs: startDate.getTime(),
      bucketEndMs: addMonths(startDate, 1, inTimezone).getTime()
    }
  }

  return {
    key: format(startDate, 'yyyy-MM-dd', inTimezone),
    bucketStartMs: startDate.getTime(),
    bucketEndMs: addDays(startDate, mode === 'week' ? 7 : 1, inTimezone).getTime()
  }
}

const buildRangeBuckets = (
  range: ReportingRange,
  asOfMs: number,
  timezone: string
): TimelineBucket[] => {
  const inTimezone = { in: tz(timezone) }
  const mode = RANGE_BUCKET_MODE[range]
  const count = RANGE_BUCKET_COUNT[range]

  const asOfDate = new Date(asOfMs)

  if (mode === 'month') {
    const endMonthStart = startOfMonth(asOfDate, inTimezone)

    return Array.from({ length: count }, (_, idx) => {
      const startDate = addMonths(endMonthStart, idx - count + 1, inTimezone)
      return buildTimelineBucket(range, startDate, timezone)
    })
  }

  if (mode === 'week') {
    const endWeekStart = startOfWeek(asOfDate, {
      ...inTimezone,
      weekStartsOn: 1
    })

    return Array.from({ length: count }, (_, idx) => {
      const startDate = addWeeks(endWeekStart, idx - count + 1, inTimezone)
      return buildTimelineBucket(range, startDate, timezone)
    })
  }

  const endDayStart = startOfDay(asOfDate, inTimezone)
  return Array.from({ length: count }, (_, idx) => {
    const startDate = addDays(endDayStart, idx - count + 1, inTimezone)
    return buildTimelineBucket(range, startDate, timezone)
  })
}

const toBucketKey = (range: ReportingRange, startedAt: number, timezone: string): string => {
  const inTimezone = { in: tz(timezone) }
  const mode = RANGE_BUCKET_MODE[range]
  const date = new Date(startedAt)

  if (mode === 'month') {
    return format(startOfMonth(date, inTimezone), 'yyyy-MM', inTimezone)
  }

  if (mode === 'week') {
    return format(
      startOfWeek(date, {
        ...inTimezone,
        weekStartsOn: 1
      }),
      'yyyy-MM-dd',
      inTimezone
    )
  }

  return format(startOfDay(date, inTimezone), 'yyyy-MM-dd', inTimezone)
}

export const buildWordsTimeline = (
  range: ReportingRange,
  metrics: ReportingSessionMetric[],
  asOfMs: number,
  timezone: string
): ReportingWordsTimelinePoint[] => {
  const buckets = buildRangeBuckets(range, asOfMs, timezone)
  const keySet = new Set(buckets.map((bucket) => bucket.key))
  const wordsByKey = new Map<string, number>()

  for (const metric of metrics) {
    const key = toBucketKey(range, metric.startedAt, timezone)
    if (!keySet.has(key)) {
      continue
    }

    wordsByKey.set(key, (wordsByKey.get(key) ?? 0) + metric.wordCount)
  }

  return buckets.map((bucket) => ({
    ...bucket,
    words: wordsByKey.get(bucket.key) ?? 0
  }))
}

export const buildWpmTimeline = (
  range: ReportingRange,
  metrics: ReportingSessionMetric[],
  asOfMs: number,
  timezone: string
): ReportingWpmTimelinePoint[] => {
  const buckets = buildRangeBuckets(range, asOfMs, timezone)
  const keySet = new Set(buckets.map((bucket) => bucket.key))
  const grouped = new Map<string, { words: number; durationMs: number }>()

  for (const metric of metrics) {
    const key = toBucketKey(range, metric.startedAt, timezone)
    if (!keySet.has(key)) {
      continue
    }

    const row = grouped.get(key) ?? { words: 0, durationMs: 0 }
    row.words += metric.wordCount
    row.durationMs += Math.max(0, metric.durationMsEffective)
    grouped.set(key, row)
  }

  const points: ReportingWpmTimelinePoint[] = buckets.map((bucket) => {
    const row = grouped.get(bucket.key)

    const wpm = row && row.durationMs > 0 ? roundTo(row.words / (row.durationMs / 60_000), 2) : null

    return {
      ...bucket,
      wpm,
      rollingWpm: null
    }
  })

  return points.map((point, idx) => {
    const window = points.slice(Math.max(0, idx - 2), idx + 1).map((entry) => entry.wpm)
    const valid = window.filter((value): value is number => value !== null)

    return {
      ...point,
      rollingWpm:
        valid.length > 0
          ? roundTo(valid.reduce((sum, value) => sum + value, 0) / valid.length, 2)
          : null
    }
  })
}

const buildTrailingMonthBuckets = (
  asOfMs: number,
  timezone: string,
  count: number
): TimelineBucket[] => {
  const inTimezone = { in: tz(timezone) }
  const endMonthStart = startOfMonth(new Date(asOfMs), inTimezone)

  return Array.from({ length: count }, (_, idx) => {
    const startDate = addMonths(endMonthStart, idx - count + 1, inTimezone)
    return buildTimelineBucket('12m', startDate, timezone)
  })
}

export const buildMonthlyOutput = (
  metrics: ReportingSessionMetric[],
  timezone: string,
  asOfMs: number
): GetHomeMonthlyOutputResponse['monthlyWords'] => {
  const buckets = buildTrailingMonthBuckets(asOfMs, timezone, 12)
  const keySet = new Set(buckets.map((bucket) => bucket.key))
  const wordsByKey = new Map<string, number>()

  for (const metric of metrics) {
    const key = toBucketKey('12m', metric.startedAt, timezone)
    if (!keySet.has(key)) {
      continue
    }

    wordsByKey.set(key, (wordsByKey.get(key) ?? 0) + metric.wordCount)
  }

  const points: ReportingMonthlyOutputPoint[] = buckets.map((bucket) => ({
    key: bucket.key,
    monthStartMs: bucket.bucketStartMs,
    monthEndMs: bucket.bucketEndMs,
    words: wordsByKey.get(bucket.key) ?? 0
  }))

  return points
}
