import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { sessions, transcripts } from './schema'

type SessionInsert = InferInsertModel<typeof sessions>
type TranscriptInsert = InferInsertModel<typeof transcripts>

export type CreateSessionInput = Omit<SessionInsert, 'id' | 'startedAt'> & {
  startedAt?: number
}

export type CreateSessionResult = {
  id: number
}

export type AddTranscriptInput = Omit<TranscriptInsert, 'id' | 'createdAt'> & {
  createdAt?: number
}

export type AddTranscriptResult = {
  id: number
}

export type ListTranscriptsInput = {
  sessionId?: number
  limit?: number
  offset?: number
}

export type Transcript = InferSelectModel<typeof transcripts>

export type ListTranscriptsResult = {
  items: Transcript[]
}

export type Session = InferSelectModel<typeof sessions>

export type ListSessionsInput = {
  limit?: number
  offset?: number
}

export type ListSessionsResult = {
  items: Session[]
}
