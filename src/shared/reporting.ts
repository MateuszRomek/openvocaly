export type ReportingRange = '7d' | '30d' | '90d' | '12m'

export type ReportingBaseParams = {
  asOfMs?: number
}

export type ReportingRangeParams = ReportingBaseParams & {
  range: ReportingRange
}

export type ReportingMetricDeltas = {
  averageWpmPct: number | null
  wordsPct: number | null
  totalMinutesPct: number | null
  sessionsPct: number | null
}

export type ReportingRangeSummary = {
  averageWpm: number
  words: number
  totalMinutes: number
  sessions: number
}

export type ReportingLifetimeSummary = {
  words: number
  totalMinutes: number
  sessions: number
}

export type GetHomeSummaryParams = ReportingRangeParams

export type GetHomeSummaryResponse = {
  range: ReportingRange
  timezone: string
  asOfMs: number
  summary: ReportingRangeSummary
  deltas: ReportingMetricDeltas
  lifetime: ReportingLifetimeSummary
}

export type ReportingWordsTimelinePoint = {
  key: string
  bucketStartMs: number
  bucketEndMs: number
  words: number
}

export type ReportingWpmTimelinePoint = {
  key: string
  bucketStartMs: number
  bucketEndMs: number
  wpm: number | null
  rollingWpm: number | null
}

export type GetHomeRangeTimelinesParams = ReportingRangeParams

export type GetHomeRangeTimelinesResponse = {
  range: ReportingRange
  timezone: string
  asOfMs: number
  wordsTimeline: ReportingWordsTimelinePoint[]
  wpmTimeline: ReportingWpmTimelinePoint[]
}

export type ReportingMonthlyOutputPoint = {
  key: string
  monthStartMs: number
  monthEndMs: number
  words: number
}

export type GetHomeMonthlyOutputParams = ReportingBaseParams

export type GetHomeMonthlyOutputResponse = {
  timezone: string
  asOfMs: number
  monthlyWords: ReportingMonthlyOutputPoint[]
}

export type GetHomeAppsParams = ReportingRangeParams & {
  topLimit?: number
}

export type ReportingTopAppRow = {
  appKey: string
  appLabel: string
  words: number
  sharePct: number
}

export type ReportingAppDetailRow = {
  appKey: string
  appLabel: string
  words: number
  sharePct: number
  interactions: number
  averageWpm: number | null
}

export type GetHomeAppsResponse = {
  range: ReportingRange
  timezone: string
  asOfMs: number
  totalWords: number
  topApps: ReportingTopAppRow[]
  appDetails: ReportingAppDetailRow[]
}

export type GetHomeRecentSessionsParams = ReportingRangeParams & {
  limit?: number
}

export type ReportingRecentSessionRow = {
  sessionId: number
  startedAt: number
  words: number
  wpm: number | null
  durationMinutes: number
  appLabel: string
  appIdentifier: string | null
}

export type GetHomeRecentSessionsResponse = {
  range: ReportingRange
  timezone: string
  asOfMs: number
  items: ReportingRecentSessionRow[]
}
