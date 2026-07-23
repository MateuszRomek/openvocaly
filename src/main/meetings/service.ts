import { app } from 'electron'
import { copyFile, mkdir, rm, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type {
  GetMeetingResponse,
  ImportMeetingResponse,
  ListMeetingsResponse,
  MeetingActionResponse
} from '../../shared/meetings'
import { MEETING_AUDIO_EXTENSIONS } from '../../shared/meetings'
import { createUuid } from '../helpers/id'
import { createLogger } from '../helpers/logger'
import { dedupeChunkBoundary } from '../transcription/local/chunking'
import type { TranscriptionService } from '../transcription/service'
import { splitMediaFileIntoWavChunks } from '../transcription/local/ffmpeg-utils'
import { MeetingsRepository } from './repository'

const MEETING_CHUNK_DURATION_SECONDS = 5 * 60
const MEETING_CHUNK_OVERLAP_SECONDS = 2
const SUPPORTED_EXTENSIONS = new Set<string>(MEETING_AUDIO_EXTENSIONS)

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim() ? error.message : fallback

export class MeetingsService {
  private readonly logger = createLogger('meetings.service')
  private readonly pendingIds = new Set<string>()
  private activeMeetingId: string | null = null
  private processingPromise: Promise<void> | null = null
  private cancelledMeetingIds = new Set<string>()
  private stopping = false

  constructor(
    private readonly transcriptionService: TranscriptionService,
    private readonly repository = new MeetingsRepository()
  ) {}

  async initialize(): Promise<void> {
    this.stopping = false
    const cancellingIds = await this.repository.listCancellingIds()
    for (const meetingId of cancellingIds) {
      await this.repository.markCancelled(meetingId)
    }

    const recoverableIds = await this.repository.listRecoverableIds()
    for (const meetingId of recoverableIds) {
      await this.repository.markQueued(meetingId)
      this.pendingIds.add(meetingId)
    }
    this.schedulePump()
  }

  async shutdown(): Promise<void> {
    this.stopping = true
    if (this.activeMeetingId) {
      const cancellationWasRequested = this.cancelledMeetingIds.has(this.activeMeetingId)
      this.cancelledMeetingIds.add(this.activeMeetingId)
      if (cancellationWasRequested) {
        await this.repository.markCancelled(this.activeMeetingId)
      } else {
        await this.repository.markQueued(this.activeMeetingId)
      }
    }
    await this.processingPromise
  }

  async list(): Promise<ListMeetingsResponse> {
    return {
      items: await this.repository.list()
    }
  }

  async get(meetingId: string): Promise<GetMeetingResponse> {
    return {
      meeting: await this.repository.getDetails(meetingId)
    }
  }

  async importFile(sourcePath: string): Promise<ImportMeetingResponse> {
    const extension = extname(sourcePath).slice(1).toLowerCase()
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      return {
        ok: false,
        message: 'Choose a supported audio or video file.'
      }
    }

    try {
      const sourceInfo = await stat(sourcePath)
      if (!sourceInfo.isFile()) {
        return {
          ok: false,
          message: 'The selected path is not a file.'
        }
      }

      const preferences = this.transcriptionService.getPreferences().preferences
      if (
        preferences.providerId !== 'local-whisper' &&
        preferences.providerId !== 'local-parakeet'
      ) {
        return {
          ok: false,
          message: 'Select an installed local model in Models before importing a meeting.'
        }
      }

      const meetingId = createUuid()
      const meetingDir = this.resolveMeetingDir(meetingId)

      try {
        await mkdir(meetingDir, { recursive: true })
        const sourceFileName = basename(sourcePath)
        const managedSourcePath = join(meetingDir, `source.${extension}`)
        await copyFile(sourcePath, managedSourcePath)

        const meeting = await this.repository.create({
          id: meetingId,
          title: basename(sourceFileName, extname(sourceFileName)),
          sourceFileName,
          sourceFilePath: managedSourcePath,
          providerId: preferences.providerId,
          modelId: preferences.modelId
        })
        this.enqueue(meetingId)
        return { ok: true, meeting }
      } catch (error) {
        await rm(meetingDir, { recursive: true, force: true }).catch(() => undefined)
        throw error
      }
    } catch (error) {
      return {
        ok: false,
        message: toErrorMessage(error, 'Failed to import the selected recording.')
      }
    }
  }

  async cancel(meetingId: string): Promise<MeetingActionResponse> {
    const meeting = await this.repository.get(meetingId)
    if (!meeting) {
      return { ok: false, message: 'Meeting not found.' }
    }
    if (meeting.status !== 'queued' && meeting.status !== 'processing') {
      return { ok: false, message: 'This meeting is not currently processing.' }
    }

    this.pendingIds.delete(meetingId)
    this.cancelledMeetingIds.add(meetingId)
    if (this.activeMeetingId === meetingId) {
      await this.repository.markCancelling(meetingId)
    } else {
      await this.repository.markCancelled(meetingId)
    }
    return { ok: true }
  }

  async resume(meetingId: string): Promise<MeetingActionResponse> {
    const meeting = await this.repository.get(meetingId)
    if (!meeting) {
      return { ok: false, message: 'Meeting not found.' }
    }
    if (meeting.status === 'cancelling') {
      return {
        ok: false,
        message: 'The current audio chunk is still stopping. Resume in a moment.'
      }
    }
    if (
      meeting.status === 'completed' ||
      meeting.status === 'processing' ||
      meeting.status === 'queued'
    ) {
      return { ok: false, message: 'This meeting does not need to be resumed.' }
    }

    if (this.activeMeetingId === meetingId) {
      return {
        ok: false,
        message: 'The current audio chunk is still stopping. Resume in a moment.'
      }
    }

    this.cancelledMeetingIds.delete(meetingId)
    await this.repository.markQueued(meetingId)
    this.enqueue(meetingId)
    return { ok: true }
  }

  async delete(meetingId: string): Promise<MeetingActionResponse> {
    const meeting = await this.repository.get(meetingId)
    if (!meeting) {
      return { ok: false, message: 'Meeting not found.' }
    }
    if (
      meeting.status === 'processing' ||
      meeting.status === 'queued' ||
      meeting.status === 'cancelling'
    ) {
      return { ok: false, message: 'Cancel processing before deleting this meeting.' }
    }
    if (this.activeMeetingId === meetingId) {
      return {
        ok: false,
        message: 'The current audio chunk is still stopping. Try deleting again in a moment.'
      }
    }

    await this.repository.delete(meetingId)
    await rm(this.resolveMeetingDir(meetingId), { recursive: true, force: true })
    return { ok: true }
  }

  private enqueue(meetingId: string): void {
    this.pendingIds.add(meetingId)
    this.schedulePump()
  }

  private schedulePump(): void {
    if (this.processingPromise || this.stopping) {
      return
    }

    this.processingPromise = this.pump().finally(() => {
      this.processingPromise = null
      if (this.pendingIds.size > 0 && !this.stopping) {
        this.schedulePump()
      }
    })
  }

  private async pump(): Promise<void> {
    while (this.pendingIds.size > 0 && !this.stopping) {
      const meetingId = this.pendingIds.values().next().value as string | undefined
      if (!meetingId) {
        return
      }
      this.pendingIds.delete(meetingId)
      this.activeMeetingId = meetingId
      await this.processMeeting(meetingId)
      this.activeMeetingId = null
      this.cancelledMeetingIds.delete(meetingId)
    }
  }

  private async processMeeting(meetingId: string): Promise<void> {
    const meeting = await this.repository.get(meetingId)
    const sourceFilePath = await this.repository.getSourceFilePath(meetingId)
    if (!meeting || !sourceFilePath) {
      await this.repository.markFailed(meetingId, 'Imported recording is missing.')
      return
    }
    if (meeting.providerId !== 'local-parakeet' && meeting.providerId !== 'local-whisper') {
      await this.repository.markFailed(
        meetingId,
        'This meeting references an unsupported local transcription provider.'
      )
      return
    }

    let chunksDir: string | null = null

    try {
      await this.repository.markProcessing(meetingId)
      const splitResult = await splitMediaFileIntoWavChunks(sourceFilePath, {
        chunkDurationSeconds: MEETING_CHUNK_DURATION_SECONDS,
        chunkOverlapSeconds: MEETING_CHUNK_OVERLAP_SECONDS,
        chunkFilePrefix: `openvocaly-meeting-${meetingId}`,
        sampleRate: 16000,
        channels: 1
      })
      chunksDir = splitResult.chunksDir
      if (this.stopping || this.cancelledMeetingIds.has(meetingId)) {
        if (!this.stopping) {
          await this.repository.markCancelled(meetingId)
        }
        return
      }
      await this.repository.setChunkPlan(
        meetingId,
        splitResult.durationMs,
        splitResult.chunks.length
      )

      const existingDetails = await this.repository.getDetails(meetingId)
      const completedSegments = new Map(
        existingDetails?.segments.map((segment) => [segment.chunkIndex, segment]) ?? []
      )
      let chunkStartMs = 0
      let failedChunks = 0
      let previousSegmentText = ''

      for (let index = 0; index < splitResult.chunks.length; index += 1) {
        const chunk = splitResult.chunks[index]
        const chunkIndex = index + 1
        const chunkEndMs = chunkStartMs + chunk.durationMs

        if (this.stopping || this.cancelledMeetingIds.has(meetingId)) {
          if (!this.stopping) {
            await this.repository.markCancelled(meetingId)
          }
          return
        }

        const completedSegment = completedSegments.get(chunkIndex)
        if (completedSegment) {
          const segmentText = dedupeChunkBoundary(previousSegmentText, completedSegment.text, {
            maxOverlapTokens: 32
          })
          if (segmentText !== completedSegment.text) {
            await this.repository.persistSegment({
              meetingId,
              chunkIndex,
              startMs: completedSegment.startMs,
              endMs: completedSegment.endMs,
              text: segmentText
            })
          }
          previousSegmentText = segmentText
        } else {
          const result = await this.transcriptionService.transcribeLocalFile(
            chunk.filePath,
            `${meetingId}:${chunkIndex}`,
            {
              providerId: meeting.providerId,
              modelId: meeting.modelId
            }
          )

          if (this.stopping) {
            return
          }

          if (result.ok && result.transcript.text.trim()) {
            const segmentText = dedupeChunkBoundary(
              previousSegmentText,
              result.transcript.text.trim(),
              { maxOverlapTokens: 32 }
            )
            await this.repository.persistSegment({
              meetingId,
              chunkIndex,
              startMs: chunkStartMs,
              endMs: chunkEndMs,
              text: segmentText
            })
            previousSegmentText = segmentText
          } else {
            failedChunks += 1
            this.logger.warn({
              event: 'meeting_chunk_failed',
              meetingId,
              chunkIndex,
              message: result.ok ? 'Empty transcription result.' : result.message
            })
          }

          if (this.cancelledMeetingIds.has(meetingId)) {
            await this.repository.markCancelled(meetingId)
            return
          }
        }

        chunkStartMs = chunkEndMs
      }

      if (this.stopping || this.cancelledMeetingIds.has(meetingId)) {
        if (!this.stopping) {
          await this.repository.markCancelled(meetingId)
        }
        return
      }

      const details = await this.repository.getDetails(meetingId)
      const completedChunks = details?.segments.length ?? 0
      if (completedChunks === 0) {
        await this.repository.markFailed(
          meetingId,
          failedChunks > 0
            ? 'The local model could not transcribe any part of this recording.'
            : 'No speech was detected in this recording.'
        )
        return
      }

      await this.repository.markCompleted(
        meetingId,
        completedChunks === splitResult.chunks.length ? 'completed' : 'partial'
      )
    } catch (error) {
      if (!this.stopping && !this.cancelledMeetingIds.has(meetingId)) {
        await this.repository.markFailed(
          meetingId,
          toErrorMessage(error, 'Meeting transcription failed.')
        )
      }
    } finally {
      if (chunksDir) {
        await rm(chunksDir, { recursive: true, force: true }).catch(() => undefined)
      }
    }
  }

  private resolveMeetingDir(meetingId: string): string {
    return join(app.getPath('userData'), 'meetings', meetingId)
  }
}
