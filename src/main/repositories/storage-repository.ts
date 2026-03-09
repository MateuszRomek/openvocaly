import { desc, eq } from 'drizzle-orm'
import type {
  AddTranscriptInput,
  AddTranscriptResult,
  CreateSessionInput,
  CreateSessionResult,
  ListSessionsInput,
  ListSessionsResult,
  ListTranscriptsInput,
  ListTranscriptsResult
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
  createSession(params: CreateSessionInput): CreateSessionResult {
    const db = getDb()
    const startedAt = params.startedAt ?? Date.now()

    const result = db
      .insert(sessions)
      .values({
        startedAt,
        durationMs: params.durationMs ?? null,
        title: params.title ?? null,
        source: params.source ?? null
      })
      .run()

    return { id: Number(result.lastInsertRowid) }
  }

  addTranscript(params: AddTranscriptInput): AddTranscriptResult {
    const db = getDb()
    const createdAt = params.createdAt ?? Date.now()

    const result = db
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

  listTranscripts(params: ListTranscriptsInput = {}): ListTranscriptsResult {
    const db = getDb()
    const limit = normalizeLimit(params.limit)
    const offset = Math.max(params.offset ?? 0, 0)

    const baseQuery = params.sessionId
      ? db.select().from(transcripts).where(eq(transcripts.sessionId, params.sessionId))
      : db.select().from(transcripts)

    const items = baseQuery.orderBy(desc(transcripts.createdAt)).limit(limit).offset(offset).all()

    return { items }
  }

  listSessions(params: ListSessionsInput = {}): ListSessionsResult {
    const db = getDb()
    const limit = normalizeLimit(params.limit)
    const offset = Math.max(params.offset ?? 0, 0)

    const items = db
      .select()
      .from(sessions)
      .orderBy(desc(sessions.startedAt))
      .limit(limit)
      .offset(offset)
      .all()

    return { items }
  }
}
