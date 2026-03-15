export type ReportingSessionMetric = {
  sessionId: number
  startedAt: number
  wordCount: number
  durationMsEffective: number
  targetAppName: string | null
  targetAppIdentifier: string | null
  targetAppPath: string | null
}

export type ReportingSummary = {
  averageWpm: number
  words: number
  totalMinutes: number
  sessions: number
}
