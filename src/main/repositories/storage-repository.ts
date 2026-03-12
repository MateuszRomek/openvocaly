import { and, desc, eq, isNull } from 'drizzle-orm'
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
import { sessionMetrics, sessions, transcripts } from '../../shared/schema'
import { getDb } from '../db'
import { computeWordsPerMinute, countWords } from '../helpers/text-metrics'

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
    const wpm = computeWordsPerMinute(wordCount, durationMsEffective)
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
          wpm,
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
