import { asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type {
  MeetingDetails,
  MeetingListItem,
  MeetingSegment,
  MeetingStatus
} from '../../shared/meetings'
import { meetingSegments, meetings } from '../../shared/schema'
import { getDb } from '../db'

type CreateMeetingInput = {
  id: string
  title: string
  sourceFileName: string
  sourceFilePath: string
  providerId: string
  modelId: string
}

type PersistMeetingSegmentInput = {
  meetingId: string
  chunkIndex: number
  startMs: number
  endMs: number
  text: string
}

const toMeetingListItem = (row: typeof meetings.$inferSelect): MeetingListItem => ({
  id: row.id,
  title: row.title,
  sourceFileName: row.sourceFileName,
  status: row.status as MeetingStatus,
  providerId: row.providerId,
  modelId: row.modelId,
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  durationMs: row.durationMs === null ? null : Number(row.durationMs),
  completedChunks: Number(row.completedChunks),
  totalChunks: Number(row.totalChunks),
  errorMessage: row.errorMessage ?? null
})

const toMeetingSegment = (row: typeof meetingSegments.$inferSelect): MeetingSegment => ({
  id: Number(row.id),
  meetingId: row.meetingId,
  chunkIndex: Number(row.chunkIndex),
  startMs: Number(row.startMs),
  endMs: Number(row.endMs),
  text: row.text,
  createdAt: Number(row.createdAt)
})

export class MeetingsRepository {
  async create(input: CreateMeetingInput): Promise<MeetingListItem> {
    const now = Date.now()
    await getDb()
      .insert(meetings)
      .values({
        ...input,
        status: 'queued',
        createdAt: now,
        updatedAt: now,
        completedChunks: 0,
        totalChunks: 0
      })
      .run()

    const meeting = await this.get(input.id)
    if (!meeting) {
      throw new Error('Failed to read imported meeting.')
    }
    return meeting
  }

  async list(): Promise<MeetingListItem[]> {
    const rows = await getDb().select().from(meetings).orderBy(desc(meetings.createdAt)).all()
    return rows.map(toMeetingListItem)
  }

  async get(meetingId: string): Promise<MeetingListItem | null> {
    const rows = await getDb()
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1)
      .all()
    const row = rows[0]
    return row ? toMeetingListItem(row) : null
  }

  async getSourceFilePath(meetingId: string): Promise<string | null> {
    const rows = await getDb()
      .select({ sourceFilePath: meetings.sourceFilePath })
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1)
      .all()
    return rows[0]?.sourceFilePath ?? null
  }

  async getDetails(meetingId: string): Promise<MeetingDetails | null> {
    const meeting = await this.get(meetingId)
    if (!meeting) {
      return null
    }

    const segmentRows = await getDb()
      .select()
      .from(meetingSegments)
      .where(eq(meetingSegments.meetingId, meetingId))
      .orderBy(asc(meetingSegments.chunkIndex))
      .all()

    return {
      ...meeting,
      segments: segmentRows.map(toMeetingSegment)
    }
  }

  async listRecoverableIds(): Promise<string[]> {
    const rows = await getDb()
      .select({ id: meetings.id })
      .from(meetings)
      .where(inArray(meetings.status, ['queued', 'processing']))
      .orderBy(asc(meetings.createdAt))
      .all()
    return rows.map((row) => row.id)
  }

  async listCancellingIds(): Promise<string[]> {
    const rows = await getDb()
      .select({ id: meetings.id })
      .from(meetings)
      .where(eq(meetings.status, 'cancelling'))
      .orderBy(asc(meetings.createdAt))
      .all()
    return rows.map((row) => row.id)
  }

  async markQueued(meetingId: string): Promise<void> {
    await this.updateStatus(meetingId, 'queued', null)
  }

  async markProcessing(meetingId: string): Promise<void> {
    await this.updateStatus(meetingId, 'processing', null)
  }

  async markCompleted(meetingId: string, status: 'completed' | 'partial'): Promise<void> {
    await this.updateStatus(meetingId, status, null)
  }

  async markCancelling(meetingId: string): Promise<void> {
    await this.updateStatus(meetingId, 'cancelling', null)
  }

  async markFailed(meetingId: string, message: string): Promise<void> {
    await this.updateStatus(meetingId, 'failed', message)
  }

  async markCancelled(meetingId: string): Promise<void> {
    await this.updateStatus(meetingId, 'cancelled', null)
  }

  async setChunkPlan(meetingId: string, durationMs: number, totalChunks: number): Promise<void> {
    await getDb()
      .update(meetings)
      .set({
        durationMs,
        totalChunks,
        completedChunks: 0,
        updatedAt: Date.now()
      })
      .where(eq(meetings.id, meetingId))
      .run()
  }

  async persistSegment(input: PersistMeetingSegmentInput): Promise<void> {
    const now = Date.now()
    await getDb().transaction(async (tx) => {
      await tx
        .insert(meetingSegments)
        .values({
          ...input,
          createdAt: now
        })
        .onConflictDoUpdate({
          target: [meetingSegments.meetingId, meetingSegments.chunkIndex],
          set: {
            startMs: input.startMs,
            endMs: input.endMs,
            text: input.text,
            createdAt: now
          }
        })
        .run()

      await tx
        .update(meetings)
        .set({
          completedChunks: sql`(
            select count(*)
            from ${meetingSegments}
            where ${meetingSegments.meetingId} = ${input.meetingId}
          )`,
          updatedAt: now
        })
        .where(eq(meetings.id, input.meetingId))
        .run()
    })
  }

  async clearSegments(meetingId: string): Promise<void> {
    await getDb().delete(meetingSegments).where(eq(meetingSegments.meetingId, meetingId)).run()
  }

  async delete(meetingId: string): Promise<void> {
    await getDb().delete(meetings).where(eq(meetings.id, meetingId)).run()
  }

  private async updateStatus(
    meetingId: string,
    status: MeetingStatus,
    errorMessage: string | null
  ): Promise<void> {
    await getDb()
      .update(meetings)
      .set({
        status,
        errorMessage,
        updatedAt: Date.now()
      })
      .where(eq(meetings.id, meetingId))
      .run()
  }
}
