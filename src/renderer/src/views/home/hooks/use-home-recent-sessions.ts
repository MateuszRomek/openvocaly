import { useMemo } from 'react'
import type { HomeReportingRange } from '../constants/reporting-range'
import {
  formatRecentSessionDuration,
  formatRecentSessionTimestamp,
  formatRecentSessionWpm
} from '../helpers/reporting-recent-session-formatters'
import { useHomeRecentSessionsSuspenseQuery } from '../queries/reporting/use-home-recent-sessions-suspense-query'

const RECENT_SESSIONS_LIMIT = 6

export type HomeRecentSessionRow = {
  sessionId: number
  at: string
  words: number
  wpmDisplay: string
  duration: string
  app: string
}

export type UseHomeRecentSessionsResult = {
  sessions: HomeRecentSessionRow[]
  hasSessions: boolean
}

export function useHomeRecentSessions(range: HomeReportingRange): UseHomeRecentSessionsResult {
  const recentSessionsQuery = useHomeRecentSessionsSuspenseQuery({
    range,
    limit: RECENT_SESSIONS_LIMIT
  })

  return useMemo(() => {
    const sessions = recentSessionsQuery.data.items.map((item) => ({
      sessionId: item.sessionId,
      at: formatRecentSessionTimestamp(item.startedAt),
      words: item.words,
      wpmDisplay: formatRecentSessionWpm(item.wpm),
      duration: formatRecentSessionDuration(item.durationMinutes),
      app: item.appLabel
    }))

    return {
      sessions,
      hasSessions: sessions.length > 0
    }
  }, [recentSessionsQuery.data.items])
}
