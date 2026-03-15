import type { ReportingAppDetailRow, ReportingTopAppRow } from '../../../shared/reporting'
import type { ReportingSessionMetric } from '../types'

type AppAggregation = {
  appKey: string
  appLabel: string
  words: number
  interactions: number
  durationMs: number
}

const toAppIdentity = (metric: ReportingSessionMetric): { appKey: string; appLabel: string } => {
  const appKey = metric.targetAppIdentifier ?? metric.targetAppName ?? 'unknown'
  const appLabel = metric.targetAppName ?? metric.targetAppIdentifier ?? 'Unknown'

  return {
    appKey,
    appLabel
  }
}

const toSharePct = (value: number, total: number): number => {
  if (total <= 0) {
    return 0
  }

  return Math.round((value / total) * 10_000) / 100
}

const toAverageWpm = (words: number, durationMs: number): number | null => {
  if (words <= 0 || durationMs <= 0) {
    return null
  }

  const minutes = durationMs / 60_000
  return Math.round((words / minutes) * 100) / 100
}

export const buildAppAggregates = (
  metrics: ReportingSessionMetric[],
  topLimit: number
): {
  totalWords: number
  topApps: ReportingTopAppRow[]
  appDetails: ReportingAppDetailRow[]
} => {
  const grouped = new Map<string, AppAggregation>()

  for (const metric of metrics) {
    const identity = toAppIdentity(metric)
    const existing = grouped.get(identity.appKey)

    if (existing) {
      existing.words += metric.wordCount
      existing.interactions += 1
      existing.durationMs += Math.max(0, metric.durationMsEffective)
      continue
    }

    grouped.set(identity.appKey, {
      ...identity,
      words: metric.wordCount,
      interactions: 1,
      durationMs: Math.max(0, metric.durationMsEffective)
    })
  }

  const values = Array.from(grouped.values()).sort((a, b) => b.words - a.words)
  const totalWords = values.reduce((sum, row) => sum + row.words, 0)

  const appDetails: ReportingAppDetailRow[] = values.map((row) => ({
    appKey: row.appKey,
    appLabel: row.appLabel,
    words: row.words,
    sharePct: toSharePct(row.words, totalWords),
    interactions: row.interactions,
    averageWpm: toAverageWpm(row.words, row.durationMs)
  }))

  const topApps: ReportingTopAppRow[] = appDetails.slice(0, Math.max(1, topLimit)).map((row) => ({
    appKey: row.appKey,
    appLabel: row.appLabel,
    words: row.words,
    sharePct: row.sharePct
  }))

  return {
    totalWords,
    topApps,
    appDetails
  }
}
