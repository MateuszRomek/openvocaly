import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import type {
  AddTranscriptInput,
  AddTranscriptResult,
  CreateSessionInput,
  CreateSessionResult,
  ListSessionsInput,
  ListSessionsResult,
  ListTranscriptsInput,
  ListTranscriptsResult,
  TranscriptListItem,
  UpdateSessionTargetAppByRecordingSessionInput,
  UpdateSessionTargetAppByRecordingSessionResult
} from '../../shared/storage'
import { TRANSCRIPTS_PAGE_SIZE } from '../../shared/storage'
import { sessionMetrics, sessions, transcripts } from '../../shared/schema'
import { getDb } from '../db'
import { countWords } from '../helpers/text-metrics'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000

const normalizeLimit = (value?: number): number => {
  if (!value || value <= 0) {
    return DEFAULT_LIMIT
  }

  return Math.min(value, MAX_LIMIT)
}

const normalizePage = (value?: number): number => {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.max(1, Math.floor(value as number))
}

/**
 * Repository for session/transcript persistence and listings.
 */
export class StorageRepository {
  async createSession(params: CreateSessionInput): Promise<CreateSessionResult> {
    const db = getDb()
    const startedAt = params.startedAt ?? Date.now()

    const result = await db
      .insert(sessions)
      .values({
        startedAt,
        durationMs: params.durationMs ?? null,
        title: params.title ?? null,
        source: params.source ?? null,
        targetAppName: params.targetAppName ?? null,
        targetAppIdentifier: params.targetAppIdentifier ?? null,
        targetAppPath: params.targetAppPath ?? null
      })
      .run()

    return { id: Number(result.lastInsertRowid) }
  }

  async addTranscript(params: AddTranscriptInput): Promise<AddTranscriptResult> {
    const db = getDb()
    const createdAt = params.createdAt ?? Date.now()

    const result = await db
      .insert(transcripts)
      .values({
        sessionId: params.sessionId,
        createdAt,
        text: params.text,
        language: params.language ?? null,
        confidence: params.confidence ?? null,
        durationMs: params.durationMs ?? null
      })
      .run()

    return { id: Number(result.lastInsertRowid) }
  }

  async createSessionWithTranscriptAndMetrics(
    sessionParams: CreateSessionInput,
    transcriptParams: Omit<AddTranscriptInput, 'sessionId'>
  ): Promise<{ sessionId: number; transcriptId: number }> {
    const db = getDb()
    const startedAt = sessionParams.startedAt ?? Date.now()
    const createdAt = transcriptParams.createdAt ?? Date.now()
    const wordCount = countWords(transcriptParams.text)
    const durationMsEffective = Math.max(
      0,
      transcriptParams.durationMs ?? sessionParams.durationMs ?? 0
    )
    const computedAt = Date.now()

    return await db.transaction(async (tx) => {
      const sessionInsert = await tx
        .insert(sessions)
        .values({
          startedAt,
          durationMs: sessionParams.durationMs ?? null,
          title: sessionParams.title ?? null,
          source: sessionParams.source ?? null,
          targetAppName: sessionParams.targetAppName ?? null,
          targetAppIdentifier: sessionParams.targetAppIdentifier ?? null,
          targetAppPath: sessionParams.targetAppPath ?? null
        })
        .run()

      const sessionId = Number(sessionInsert.lastInsertRowid)

      const transcriptInsert = await tx
        .insert(transcripts)
        .values({
          sessionId,
          createdAt,
          text: transcriptParams.text,
          language: transcriptParams.language ?? null,
          confidence: transcriptParams.confidence ?? null,
          durationMs: transcriptParams.durationMs ?? null
        })
        .run()

      await tx
        .insert(sessionMetrics)
        .values({
          sessionId,
          wordCount,
          durationMsEffective,
          computedAt
        })
        .run()

      return {
        sessionId,
        transcriptId: Number(transcriptInsert.lastInsertRowid)
      }
    })
  }

  async getLatestNonEmptyTranscriptText(): Promise<string | null> {
    const db = getDb()
    const rows = await db
      .select({ text: transcripts.text })
      .from(transcripts)
      .where(sql`length(trim(${transcripts.text})) > 0`)
      .orderBy(desc(transcripts.createdAt))
      .limit(1)
      .all()

    const latest = rows[0]?.text
    return typeof latest === 'string' ? latest : null
  }

  async listTranscripts(params: ListTranscriptsInput = {}): Promise<ListTranscriptsResult> {
    const db = getDb()
    const page = normalizePage(params.page)
    const pageSize = TRANSCRIPTS_PAGE_SIZE
    const offset = (page - 1) * pageSize

    const [itemRows, countRows] = await Promise.all([
      db
        .select({
          transcriptId: transcripts.id,
          sessionId: transcripts.sessionId,
          createdAt: transcripts.createdAt,
          text: transcripts.text,
          language: transcripts.language,
          confidence: transcripts.confidence,
          durationMs: transcripts.durationMs,
          sessionStartedAt: sessions.startedAt,
          targetAppName: sessions.targetAppName,
          targetAppIdentifier: sessions.targetAppIdentifier,
          targetAppPath: sessions.targetAppPath
        })
        .from(transcripts)
        .innerJoin(sessions, eq(transcripts.sessionId, sessions.id))
        .orderBy(desc(transcripts.createdAt), desc(transcripts.id))
        .limit(pageSize)
        .offset(offset)
        .all(),
      db
        .select({
          totalItems: sql<number>`count(*)`
        })
        .from(transcripts)
        .all()
    ])

    const totalItems = Number(countRows[0]?.totalItems ?? 0)
    const totalPages = Math.ceil(totalItems / pageSize)
    const items: TranscriptListItem[] = itemRows.map((row) => ({
      transcriptId: Number(row.transcriptId),
      sessionId: Number(row.sessionId),
      createdAt: Number(row.createdAt),
      text: row.text,
      language: row.language ?? null,
      confidence: row.confidence === null ? null : Number(row.confidence),
      durationMs: row.durationMs === null ? null : Number(row.durationMs),
      sessionStartedAt: Number(row.sessionStartedAt),
      targetAppName: row.targetAppName ?? null,
      targetAppIdentifier: row.targetAppIdentifier ?? null,
      targetAppPath: row.targetAppPath ?? null
    }))

    return {
      items,
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages
    }
  }

  async listSessions(params: ListSessionsInput = {}): Promise<ListSessionsResult> {
    const db = getDb()
    const limit = normalizeLimit(params.limit)
    const offset = Math.max(params.offset ?? 0, 0)

    const items = await db
      .select()
      .from(sessions)
      .orderBy(desc(sessions.startedAt))
      .limit(limit)
      .offset(offset)
      .all()

    return { items }
  }

  async updateSessionTargetAppByRecordingSession(
    params: UpdateSessionTargetAppByRecordingSessionInput
  ): Promise<UpdateSessionTargetAppByRecordingSessionResult> {
    const db = getDb()
    const source = `recording:${params.recordingSessionId}`
    const baseWhere = eq(sessions.source, source)
    const whereCondition = params.onlyIfMissing
      ? and(
          baseWhere,
          isNull(sessions.targetAppName),
          isNull(sessions.targetAppIdentifier),
          isNull(sessions.targetAppPath)
        )
      : baseWhere

    const result = await db
      .update(sessions)
      .set({
        targetAppName: params.targetApp.name ?? null,
        targetAppIdentifier: params.targetApp.identifier ?? null,
        targetAppPath: params.targetApp.appPath ?? null
      })
      .where(whereCondition)
      .run()

    return {
      updated: result.rowsAffected > 0
    }
  }
}
