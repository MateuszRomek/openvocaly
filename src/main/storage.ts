import { ipcMain } from 'electron'
import { desc, eq } from 'drizzle-orm'
import { getDb } from './db'
import { sessions, transcripts } from '../shared/schema'
import type {
  AddTranscriptInput,
  AddTranscriptResult,
  CreateSessionInput,
  CreateSessionResult,
  ListSessionsInput,
  ListSessionsResult,
  ListTranscriptsInput,
  ListTranscriptsResult
} from '../shared/storage'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000

const normalizeLimit = (value?: number): number => {
  if (!value || value <= 0) {
    return DEFAULT_LIMIT
  }

  return Math.min(value, MAX_LIMIT)
}

export const registerStorageIpc = (): void => {
  ipcMain.handle(
    'storage:createSession',
    (_event, input: CreateSessionInput): CreateSessionResult => {
      const db = getDb()
      const startedAt = input.startedAt ?? Date.now()

      const result = db
        .insert(sessions)
        .values({
          startedAt,
          durationMs: input.durationMs ?? null,
          title: input.title ?? null,
          source: input.source ?? null
        })
        .run()

      return { id: Number(result.lastInsertRowid) }
    }
  )

  ipcMain.handle(
    'storage:addTranscript',
    (_event, input: AddTranscriptInput): AddTranscriptResult => {
      const db = getDb()
      const createdAt = input.createdAt ?? Date.now()

      const result = db
        .insert(transcripts)
        .values({
          sessionId: input.sessionId,
          createdAt,
          text: input.text,
          language: input.language ?? null,
          confidence: input.confidence ?? null,
          durationMs: input.durationMs ?? null
        })
        .run()

      return { id: Number(result.lastInsertRowid) }
    }
  )

  ipcMain.handle(
    'storage:listTranscripts',
    (_event, input: ListTranscriptsInput = {}): ListTranscriptsResult => {
      const db = getDb()
      const limit = normalizeLimit(input.limit)
      const offset = Math.max(input.offset ?? 0, 0)

      const baseQuery = input.sessionId
        ? db.select().from(transcripts).where(eq(transcripts.sessionId, input.sessionId))
        : db.select().from(transcripts)

      const items = baseQuery.orderBy(desc(transcripts.createdAt)).limit(limit).offset(offset).all()

      return { items }
    }
  )

  ipcMain.handle(
    'storage:listSessions',
    (_event, input: ListSessionsInput = {}): ListSessionsResult => {
      const db = getDb()
      const limit = normalizeLimit(input.limit)
      const offset = Math.max(input.offset ?? 0, 0)

      const items = db
        .select()
        .from(sessions)
        .orderBy(desc(sessions.startedAt))
        .limit(limit)
        .offset(offset)
        .all()

      return { items }
    }
  )
}
