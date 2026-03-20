import type { ReportingSessionMetric, ReportingSummary } from '../types'

const roundTo = (value: number, precision: number): number => {
  const multiplier = 10 ** precision
  return Math.round(value * multiplier) / multiplier
}

export const summarizeMetrics = (metrics: ReportingSessionMetric[]): ReportingSummary => {
  const words = metrics.reduce((sum, metric) => sum + metric.wordCount, 0)
  const durationMs = metrics.reduce(
    (sum, metric) => sum + Math.max(0, metric.durationMsEffective),
    0
  )
  const totalMinutes = durationMs / 60_000
  const sessions = metrics.length

  const averageWpm = durationMs > 0 ? words / totalMinutes : 0

  return {
    averageWpm: roundTo(averageWpm, 2),
    words,
    totalMinutes: roundTo(totalMinutes, 2),
    sessions
  }
}

export const toDeltaPct = (current: number, previous: number): number | null => {
  if (previous === 0) {
    return null
  }

  return roundTo(((current - previous) / Math.abs(previous)) * 100, 2)
}

const MIN_DELTA_BASELINE_SESSIONS = 5
const MIN_DELTA_BASELINE_TOTAL_MINUTES = 10

export const hasSufficientDeltaBaseline = (summary: ReportingSummary): boolean =>
  summary.sessions >= MIN_DELTA_BASELINE_SESSIONS &&
  summary.totalMinutes >= MIN_DELTA_BASELINE_TOTAL_MINUTES
