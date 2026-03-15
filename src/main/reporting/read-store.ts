import type { ReportingSessionMetric } from './types'

export type TimeWindowFactsQuery = {
  fromMs: number
  toMs: number
}

export type ReportingReadStore = {
  listMetricsInWindow: (params: TimeWindowFactsQuery) => Promise<ReportingSessionMetric[]>
  getLifetimeTotals: () => Promise<{ words: number; totalMinutes: number; sessions: number }>
}
