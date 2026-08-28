import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/openvocaly-transcription-workflow-test' }
}))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))

import type { RecordingArtifact } from '../../shared/recording'
import type { TranscriptionResult } from '../../shared/transcription'
import type { RecordingArtifactManager } from '../recording/storage/artifact-manager'
import { DictationTranscriptionWorkflow } from './transcription-workflow'

const artifact: RecordingArtifact = {
  sessionId: 'session-1',
  mode: 'toggle',
  format: 'webm_opus',
  filePath: '/recordings/session-1.webm',
  startedAt: 1,
  stoppedAt: 2,
  durationMs: 1
}

describe('DictationTranscriptionWorkflow', () => {
  it('retains a canceled recording as an aborted artifact without reporting an error', async () => {
    const markFailure = vi.fn(async (): Promise<void> => undefined)
    const markTranscriptionSuccess = vi.fn(async (): Promise<void> => undefined)
    const playCue = vi.fn(async (): Promise<void> => undefined)
    const transcriptionResult: TranscriptionResult = {
      ok: false,
      code: 'cancelled',
      message: 'Transcription cancelled.'
    }
    const transcriptionService = {
      transcribeArtifact: vi.fn(
        async (_artifact: RecordingArtifact, options?: { signal?: AbortSignal }) => {
          expect(options?.signal).toBeDefined()
          return transcriptionResult
        }
      )
    }
    const artifactManager = {
      markFailure,
      markTranscriptionSuccess
    } as unknown as RecordingArtifactManager
    const workflow = new DictationTranscriptionWorkflow(
      {
        recordingService: { playCue } as never,
        transcriptionService: transcriptionService as never
      },
      artifactManager
    )

    const result = await workflow.processArtifact(artifact, {
      signal: new AbortController().signal
    })

    expect(result).toEqual({ type: 'cancelled' })
    expect(markFailure).toHaveBeenCalledWith(
      artifact,
      'aborted',
      'Transcription cancelled.',
      undefined
    )
    expect(markTranscriptionSuccess).not.toHaveBeenCalled()
    expect(playCue).not.toHaveBeenCalled()
  })

  it('keeps a result that completed after the persistence boundary was claimed', async () => {
    const controller = new AbortController()
    const tryBeginPersistence = vi.fn(() => true)
    const markFailure = vi.fn(async (): Promise<void> => undefined)
    const markTranscriptionSuccess = vi.fn(async (): Promise<void> => undefined)
    const transcriptionService = {
      transcribeArtifact: vi.fn(
        async (
          _artifact: RecordingArtifact,
          options?: { signal?: AbortSignal; tryBeginPersistence?: () => boolean }
        ): Promise<TranscriptionResult> => {
          expect(options?.tryBeginPersistence?.()).toBe(true)
          controller.abort()
          return {
            ok: true,
            transcript: { text: 'late result' }
          }
        }
      )
    }
    const workflow = new DictationTranscriptionWorkflow(
      {
        recordingService: { playCue: vi.fn() } as never,
        transcriptionService: transcriptionService as never
      },
      { markFailure, markTranscriptionSuccess } as unknown as RecordingArtifactManager
    )

    await expect(
      workflow.processArtifact(artifact, {
        signal: controller.signal,
        tryBeginPersistence
      })
    ).resolves.toEqual({
      type: 'complete',
      transcriptText: 'late result'
    })
    expect(markFailure).not.toHaveBeenCalled()
    expect(markTranscriptionSuccess).toHaveBeenCalledWith(artifact)
    expect(tryBeginPersistence).toHaveBeenCalledTimes(1)
  })
})
