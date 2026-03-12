import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm'
import { sessionMetrics, sessions } from '../../shared/schema'
import { getDb } from '../db'
import type { ReportingReadStore, TimeWindowFactsQuery } from './read-store'
import type { ReportingSessionMetric } from './types'

type ReportingSessionMetricRow = {
  sessionId: number
  startedAt: number
  wordCount: number
  wpm: number | null
  durationMsEffective: number
  targetAppName: string | null
  targetAppIdentifier: string | null
  targetAppPath: string | null
}

export class ReportingRepository implements ReportingReadStore {
  async listMetricsInWindow(params: TimeWindowFactsQuery): Promise<ReportingSessionMetric[]> {
    const db = getDb()

    const baseQuery = db
      .select({
        sessionId: sessions.id,
        startedAt: sessions.startedAt,
        wordCount: sessionMetrics.wordCount,
        wpm: sessionMetrics.wpm,
        durationMsEffective: sessionMetrics.durationMsEffective,
        targetAppName: sessions.targetAppName,
        targetAppIdentifier: sessions.targetAppIdentifier,
        targetAppPath: sessions.targetAppPath
      })
      .from(sessions)
      .innerJoin(sessionMetrics, eq(sessionMetrics.sessionId, sessions.id))
      .where(and(gte(sessions.startedAt, params.fromMs), lt(sessions.startedAt, params.toMs)))

    const orderedQuery = params.descending
      ? baseQuery.orderBy(desc(sessions.startedAt))
      : baseQuery.orderBy(asc(sessions.startedAt))

    const queryWithLimit = params.limit ? orderedQuery.limit(params.limit) : orderedQuery
    const rows = await queryWithLimit.all()

    return rows.map((row) => this.mapRowToReportingSessionMetric(row as ReportingSessionMetricRow))
  }

  async getLifetimeTotals(): Promise<{ words: number; totalMinutes: number; sessions: number }> {
    const db = getDb()

    const rows = await db
      .select({
        totalWords: sql<number>`coalesce(sum(${sessionMetrics.wordCount}), 0)`,
        totalDurationMs: sql<number>`coalesce(sum(${sessionMetrics.durationMsEffective}), 0)`,
        totalSessions: sql<number>`count(${sessionMetrics.sessionId})`
      })
      .from(sessionMetrics)
      .all()

    const row = rows[0]

    const words = Number(row?.totalWords ?? 0)
    const totalMinutes = Number(row?.totalDurationMs ?? 0) / 60_000
    const sessionsCount = Number(row?.totalSessions ?? 0)

    return {
      words,
      totalMinutes: Math.round(totalMinutes * 100) / 100,
      sessions: sessionsCount
    }
  }

  private mapRowToReportingSessionMetric(row: ReportingSessionMetricRow): ReportingSessionMetric {
    return {
      sessionId: Number(row.sessionId),
      startedAt: Number(row.startedAt),
      wordCount: Number(row.wordCount),
      wpm: row.wpm === null ? null : Number(row.wpm),
      durationMsEffective: Number(row.durationMsEffective),
      targetAppName: row.targetAppName,
      targetAppIdentifier: row.targetAppIdentifier,
      targetAppPath: row.targetAppPath
    }
  }
}
