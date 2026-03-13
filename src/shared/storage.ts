import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { sessions, transcripts } from './schema'

type SessionInsert = InferInsertModel<typeof sessions>
type TranscriptInsert = InferInsertModel<typeof transcripts>

export const STORAGE_TRANSCRIPT_ADDED_CHANNEL = 'storage:transcript-added'
export const STORAGE_SESSION_TARGET_APP_UPDATED_CHANNEL = 'storage:session-target-app-updated'

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

export type TranscriptAddedEvent = {
  transcriptId: number
  sessionId: number | null
  createdAt: number
}

export type SessionTargetAppUpdatedEvent = {
  recordingSessionId: string
  updatedAt: number
}

export const TRANSCRIPTS_PAGE_SIZE = 30

export type SessionTargetApp = {
  name: string | null
  identifier: string | null
  appPath: string | null
}

export type UpdateSessionTargetAppByRecordingSessionInput = {
  recordingSessionId: string
  targetApp: SessionTargetApp
  onlyIfMissing?: boolean
}

export type UpdateSessionTargetAppByRecordingSessionResult = {
  updated: boolean
}

export type ListTranscriptsInput = {
  page?: number
}

export type Transcript = InferSelectModel<typeof transcripts>

export type TranscriptListItem = {
  transcriptId: number
  sessionId: number
  createdAt: number
  text: string
  language: string | null
  confidence: number | null
  durationMs: number | null
  sessionStartedAt: number
  targetAppName: string | null
  targetAppIdentifier: string | null
  targetAppPath: string | null
}

export type ListTranscriptsResult = {
  items: TranscriptListItem[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
}

export type Session = InferSelectModel<typeof sessions>

export type ListSessionsInput = {
  limit?: number
  offset?: number
}

export type ListSessionsResult = {
  items: Session[]
}

export type ResolveAppIconInput = {
  appPath?: string
  appIdentifier?: string
  sizePx?: number
}

export type ResolveAppIconResult = {
  ok: boolean
  dataUrl?: string
  message?: string
}
