import { getDb, initDb } from '../../db'
import type { RecordingArtifact } from '../../../shared/recording'
import type { TranscriptionSuccessResult } from '../../../shared/transcription'
import { sessions, transcripts } from '../../../shared/schema'

export class TranscriptStore {
  async initialize(): Promise<void> {
    initDb()
  }

  async saveFromArtifact(
    artifact: RecordingArtifact,
    transcript: TranscriptionSuccessResult['transcript']
  ): Promise<void> {
    await this.initialize()

    const db = getDb()
    const createdAt = Date.now()

    const sessionInsertResult = db
      .insert(sessions)
      .values({
        startedAt: artifact.startedAt,
        durationMs: artifact.durationMs ?? null,
        title: null,
        source: `recording:${artifact.sessionId}`
      })
      .run()

    const sessionId = Number(sessionInsertResult.lastInsertRowid)

    db.insert(transcripts)
      .values({
        sessionId,
        createdAt,
        text: transcript.text,
        language: transcript.language ?? null,
        confidence: transcript.confidence ?? null,
        durationMs: transcript.durationMs ?? artifact.durationMs ?? null
      })
      .run()
  }
}
