import { app } from 'electron'
import { copyFile, mkdir, rm, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type {
  GetMeetingResponse,
  ImportMeetingResponse,
  MeetingImportSelection,
  ListMeetingsResponse,
  MeetingActionResponse
} from '../../shared/meetings'
import { MEETING_AUDIO_EXTENSIONS } from '../../shared/meetings'
import { createUuid } from '../helpers/id'
import type { TranscriptionService } from '../transcription/service'
import { MeetingsRepository } from './repository'

const SUPPORTED_EXTENSIONS = new Set<string>(MEETING_AUDIO_EXTENSIONS)

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim() ? error.message : fallback

export class MeetingsService {
  private readonly pendingIds = new Set<string>()
  private activeMeetingId: string | null = null
  private processingPromise: Promise<void> | null = null
  private cancelledMeetingIds = new Set<string>()
  private activeTranscriptionController: AbortController | null = null
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
      this.activeTranscriptionController?.abort()
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

  async importFile(
    sourcePath: string,
    selection: MeetingImportSelection
  ): Promise<ImportMeetingResponse> {
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

      const validation = await this.transcriptionService.validateLocalSelection(selection)
      if (!validation.ok) {
        return {
          ok: false,
          message: validation.message
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
          providerId: selection.providerId,
          modelId: selection.modelId
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
      this.activeTranscriptionController?.abort()
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
        message: 'The current transcription is still stopping. Resume in a moment.'
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
        message: 'The current transcription is still stopping. Resume in a moment.'
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
        message: 'The current transcription is still stopping. Try deleting again in a moment.'
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
    if (
      meeting.providerId !== 'local-parakeet' &&
      meeting.providerId !== 'local-whisper' &&
      meeting.providerId !== 'local-qwen'
    ) {
      await this.repository.markFailed(
        meetingId,
        'This meeting references an unsupported local transcription provider.'
      )
      return
    }

    const transcriptionController = new AbortController()
    this.activeTranscriptionController = transcriptionController

    try {
      await this.repository.markProcessing(meetingId)
      const existingDetails = await this.repository.getDetails(meetingId)
      if (existingDetails?.segments.length) {
        await this.repository.clearSegments(meetingId)
      }

      await this.repository.setChunkPlan(meetingId, meeting.durationMs ?? 0, 1)
      if (this.stopping || this.cancelledMeetingIds.has(meetingId)) {
        if (!this.stopping) {
          await this.repository.markCancelled(meetingId)
        }
        return
      }

      // The provider owns its long-form windowing. Meetings must not split the
      // same recording first and then make the provider split every piece again.
      const result = await this.transcriptionService.transcribeLocalFile(
        sourceFilePath,
        meetingId,
        {
          providerId: meeting.providerId,
          modelId: meeting.modelId
        },
        { signal: transcriptionController.signal }
      )

      if (this.stopping || this.cancelledMeetingIds.has(meetingId)) {
        if (!this.stopping) {
          await this.repository.markCancelled(meetingId)
        }
        return
      }

      if (!result.ok) {
        await this.repository.markFailed(
          meetingId,
          result.message ?? 'Meeting transcription failed.'
        )
        return
      }
      if (!result.transcript.text.trim()) {
        await this.repository.markFailed(meetingId, 'No speech was detected in this recording.')
        return
      }

      const durationMs =
        result.transcript.durationMs ?? result.diagnostics?.durationMs ?? meeting.durationMs ?? 0
      await this.repository.setChunkPlan(meetingId, durationMs, 1)
      await this.repository.persistSegment({
        meetingId,
        chunkIndex: 1,
        startMs: 0,
        endMs: durationMs,
        text: result.transcript.text.trim()
      })
      await this.repository.markCompleted(
        meetingId,
        result.diagnostics?.partial ? 'partial' : 'completed'
      )
    } catch (error) {
      if (this.stopping) {
        return
      }
      if (this.cancelledMeetingIds.has(meetingId)) {
        await this.repository.markCancelled(meetingId)
        return
      }
      await this.repository.markFailed(
        meetingId,
        toErrorMessage(error, 'Meeting transcription failed.')
      )
    } finally {
      if (this.activeTranscriptionController === transcriptionController) {
        this.activeTranscriptionController = null
      }
    }
  }

  private resolveMeetingDir(meetingId: string): string {
    return join(app.getPath('userData'), 'meetings', meetingId)
  }
}
