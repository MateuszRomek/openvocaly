import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
  app: { getPath: () => '/tmp/openvocaly-meetings-test' }
}))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))

import type {
  MeetingDetails,
  MeetingImportSelection,
  MeetingListItem,
  MeetingSegment
} from '../../shared/meetings'
import type { TranscriptionResult } from '../../shared/transcription'
import type { MeetingsRepository } from './repository'
import { MeetingsService } from './service'

const meeting: MeetingListItem = {
  id: 'meeting-1',
  title: 'Planning',
  sourceFileName: 'planning.mp3',
  status: 'queued',
  providerId: 'local-parakeet',
  modelId: 'parakeet-tdt-0.6b-v3-coreml',
  createdAt: 1,
  updatedAt: 1,
  durationMs: null,
  completedChunks: 0,
  totalChunks: 0,
  errorMessage: null
}

const createTranscriptResult = (): TranscriptionResult => ({
  ok: true,
  transcript: {
    text: 'The complete meeting transcript.',
    language: 'en',
    durationMs: 5 * 60 * 1000
  },
  diagnostics: {
    providerId: 'local-parakeet',
    modelId: meeting.modelId,
    durationMs: 5 * 60 * 1000,
    resultType: 'success_full'
  }
})

describe('MeetingsService', () => {
  it('transcribes the managed recording once instead of nesting a second chunking pipeline', async () => {
    const segments: MeetingSegment[] = []
    const repository = {
      get: vi.fn(async (): Promise<MeetingListItem> => ({ ...meeting, status: 'queued' })),
      getSourceFilePath: vi.fn(async (): Promise<string> => '/recordings/planning.mp3'),
      markProcessing: vi.fn(async (): Promise<void> => undefined),
      setChunkPlan: vi.fn(async (): Promise<void> => undefined),
      getDetails: vi.fn(
        async (): Promise<MeetingDetails> => ({
          ...meeting,
          status: segments.length > 0 ? 'processing' : 'queued',
          completedChunks: segments.length,
          totalChunks: 1,
          segments
        })
      ),
      persistSegment: vi.fn(async (segment: MeetingSegment): Promise<void> => {
        segments.push({ ...segment, id: segments.length + 1 })
      }),
      markCompleted: vi.fn(async (): Promise<void> => undefined),
      markFailed: vi.fn(async (): Promise<void> => undefined)
    } as unknown as MeetingsRepository

    const transcribeLocalFile = vi.fn(async (): Promise<TranscriptionResult> => {
      return createTranscriptResult()
    })
    const transcriptionService = {
      transcribeLocalFile
    } as never
    const service = new MeetingsService(transcriptionService, repository)

    await (
      service as unknown as { processMeeting: (meetingId: string) => Promise<void> }
    ).processMeeting(meeting.id)

    expect(transcribeLocalFile).toHaveBeenCalledTimes(1)
    expect(transcribeLocalFile).toHaveBeenCalledWith(
      '/recordings/planning.mp3',
      'meeting-1',
      {
        providerId: meeting.providerId,
        modelId: meeting.modelId
      },
      expect.any(Object)
    )
    expect(repository.setChunkPlan).toHaveBeenLastCalledWith(meeting.id, 5 * 60 * 1000, 1)
    expect(repository.persistSegment).toHaveBeenCalledWith({
      meetingId: meeting.id,
      chunkIndex: 1,
      startMs: 0,
      endMs: 5 * 60 * 1000,
      text: 'The complete meeting transcript.'
    })
    expect(repository.markCompleted).toHaveBeenCalledWith(meeting.id, 'completed')
  })

  it('aborts an active transcription and marks the meeting cancelled', async () => {
    let status: MeetingListItem['status'] = 'queued'
    const markCancelled = vi.fn(async (): Promise<void> => {
      status = 'cancelled'
    })
    const repository = {
      get: vi.fn(async (): Promise<MeetingListItem> => ({ ...meeting, status })),
      getSourceFilePath: vi.fn(async (): Promise<string> => '/recordings/planning.mp3'),
      markProcessing: vi.fn(async (): Promise<void> => {
        status = 'processing'
      }),
      setChunkPlan: vi.fn(async (): Promise<void> => undefined),
      getDetails: vi.fn(
        async (): Promise<MeetingDetails> => ({
          ...meeting,
          status,
          segments: []
        })
      ),
      persistSegment: vi.fn(async (): Promise<void> => undefined),
      markCompleted: vi.fn(async (): Promise<void> => undefined),
      markCancelling: vi.fn(async (): Promise<void> => {
        status = 'cancelling'
      }),
      markCancelled
    } as unknown as MeetingsRepository

    let transcriptionSignal: AbortSignal | undefined
    const transcribeLocalFile = vi.fn(
      async (
        _sourcePath: string,
        _sessionId: string,
        _selection: MeetingImportSelection,
        options?: { signal?: AbortSignal }
      ): Promise<TranscriptionResult> => {
        transcriptionSignal = options?.signal
        return await new Promise<TranscriptionResult>((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new Error('cancelled')), {
            once: true
          })
        })
      }
    )
    const transcriptionService = { transcribeLocalFile } as never
    const service = new MeetingsService(transcriptionService, repository)
    ;(service as unknown as { activeMeetingId: string }).activeMeetingId = meeting.id

    const processPromise = (
      service as unknown as { processMeeting: (meetingId: string) => Promise<void> }
    ).processMeeting(meeting.id)
    await vi.waitFor(() => expect(transcribeLocalFile).toHaveBeenCalledTimes(1))

    await expect(service.cancel(meeting.id)).resolves.toEqual({ ok: true })
    await processPromise

    expect(transcriptionSignal?.aborted).toBe(true)
    expect(markCancelled).toHaveBeenCalledWith(meeting.id)
  })
})
