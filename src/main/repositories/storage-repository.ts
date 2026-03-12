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
  UpdateSessionTargetAppByRecordingSessionInput,
  UpdateSessionTargetAppByRecordingSessionResult
} from '../../shared/storage'
import { sessions, transcripts } from '../../shared/schema'
import { getDb } from '../db'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000

const normalizeLimit = (value?: number): number => {
  if (!value || value <= 0) {
    return DEFAULT_LIMIT
  }

  return Math.min(value, MAX_LIMIT)
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
    const limit = normalizeLimit(params.limit)
    const offset = Math.max(params.offset ?? 0, 0)

    const baseQuery = params.sessionId
      ? db.select().from(transcripts).where(eq(transcripts.sessionId, params.sessionId))
      : db.select().from(transcripts)

    const items = await baseQuery
      .orderBy(desc(transcripts.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    return { items }
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
