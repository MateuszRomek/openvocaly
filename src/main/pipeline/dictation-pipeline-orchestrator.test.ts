import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/openvocaly-pipeline-test' }
}))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))

import type { RecordingArtifact } from '../../shared/recording'
import type { RecordingCommand } from '../recording/command-bus'
import { DictationPipelineOrchestrator } from './dictation-pipeline-orchestrator'
import { DictationSessionStateManager } from './session'

const artifact: RecordingArtifact = {
  sessionId: 'session-1',
  mode: 'toggle',
  format: 'webm_opus',
  filePath: '/recordings/session-1.webm',
  startedAt: 1,
  stoppedAt: 2,
  durationMs: 1
}

const cancelCommand: RecordingCommand = {
  type: 'cancel',
  emittedAt: 1
}

describe('DictationPipelineOrchestrator transcription cancellation', () => {
  it('aborts the active transcription and moves the overlay to a short canceled state', async () => {
    let transcriptionSignal: AbortSignal | undefined
    let resolveWorkflow: ((result: { type: 'cancelled' }) => void) | undefined
    const workflowResult = new Promise<{ type: 'cancelled' }>((resolve) => {
      resolveWorkflow = resolve
    })
    const session = new DictationSessionStateManager()
    const publishImmediate = vi.fn(async (): Promise<void> => undefined)
    const schedule = vi.fn()
    const processArtifact = vi.fn(
      async (
        _artifact: RecordingArtifact,
        options?: { signal?: AbortSignal }
      ): Promise<{ type: 'cancelled' }> => {
        transcriptionSignal = options?.signal
        return await workflowResult
      }
    )
    const orchestrator = new DictationPipelineOrchestrator({
      commandBus: {} as never,
      sessionBus: {} as never,
      artifactBus: {} as never,
      recordingService: {} as never,
      overlayPublisher: { publishImmediate } as never,
      session,
      idleReset: {
        clear: vi.fn(),
        schedule,
        destroy: vi.fn()
      } as never,
      transcriptionWorkflow: { processArtifact } as never,
      pasteService: { cancelActiveFallback: vi.fn() } as never,
      storageRepository: {} as never
    })
    ;(orchestrator as unknown as { initialized: boolean }).initialized = true

    const handleArtifactReady = (
      orchestrator as unknown as {
        handleArtifactReady: (artifact: RecordingArtifact) => Promise<void>
      }
    ).handleArtifactReady(artifact)

    await vi.waitFor(() => expect(processArtifact).toHaveBeenCalledTimes(1))
    expect(session.phase).toBe('transcribing')

    await (
      orchestrator as unknown as {
        handleShortcutCommand: (command: RecordingCommand) => Promise<void>
      }
    ).handleShortcutCommand(cancelCommand)

    expect(transcriptionSignal?.aborted).toBe(true)
    expect(session.phase).toBe('failed')
    expect(session.toRuntimeStateResponse().state.failureReason).toBe('aborted')
    expect(schedule).toHaveBeenCalledWith(120, expect.any(Function))

    resolveWorkflow?.({ type: 'cancelled' })
    await handleArtifactReady
    expect(publishImmediate).toHaveBeenCalled()
  })

  it('does not cancel after the persistence boundary has started or paste a late result', async () => {
    let transcriptionSignal: AbortSignal | undefined
    let resolveWorkflow:
      | ((result: { type: 'complete'; transcriptText: string }) => void)
      | undefined
    const workflowResult = new Promise<{ type: 'complete'; transcriptText: string }>((resolve) => {
      resolveWorkflow = resolve
    })
    const session = new DictationSessionStateManager()
    const processArtifact = vi.fn(
      async (
        _artifact: RecordingArtifact,
        options?: { signal?: AbortSignal; tryBeginPersistence?: () => boolean }
      ): Promise<{ type: 'complete'; transcriptText: string }> => {
        transcriptionSignal = options?.signal
        expect(options?.tryBeginPersistence?.()).toBe(true)
        return await workflowResult
      }
    )
    const processTranscript = vi.fn(async () => ({ type: 'auto_paste_success', targetApp: null }))
    const orchestrator = new DictationPipelineOrchestrator({
      commandBus: {} as never,
      sessionBus: {} as never,
      artifactBus: {} as never,
      recordingService: { resetSessionToIdle: vi.fn() } as never,
      overlayPublisher: { publishImmediate: vi.fn(async (): Promise<void> => undefined) } as never,
      session,
      idleReset: {
        clear: vi.fn(),
        schedule: vi.fn(),
        destroy: vi.fn()
      } as never,
      transcriptionWorkflow: { processArtifact } as never,
      pasteService: {
        cancelActiveFallback: vi.fn(),
        processTranscript
      } as never,
      storageRepository: {} as never
    })
    ;(orchestrator as unknown as { initialized: boolean }).initialized = true

    const handleArtifactReady = (
      orchestrator as unknown as {
        handleArtifactReady: (artifact: RecordingArtifact) => Promise<void>
      }
    ).handleArtifactReady(artifact)

    await vi.waitFor(() => expect(processArtifact).toHaveBeenCalledTimes(1))
    await (
      orchestrator as unknown as {
        handleShortcutCommand: (command: RecordingCommand) => Promise<void>
      }
    ).handleShortcutCommand(cancelCommand)

    expect(transcriptionSignal?.aborted).toBe(false)
    expect(session.phase).toBe('transcribing')

    resolveWorkflow?.({ type: 'complete', transcriptText: 'late result' })
    await handleArtifactReady

    expect(processTranscript).toHaveBeenCalledWith(
      expect.objectContaining({ transcriptText: 'late result' })
    )
  })

  it('waits for active transcription cleanup before destroying collaborators on shutdown', async () => {
    let transcriptionSignal: AbortSignal | undefined
    let resolveWorkflow: ((result: { type: 'cancelled' }) => void) | undefined
    const workflowResult = new Promise<{ type: 'cancelled' }>((resolve) => {
      resolveWorkflow = resolve
    })
    const processArtifact = vi.fn(
      async (
        _artifact: RecordingArtifact,
        options?: { signal?: AbortSignal }
      ): Promise<{ type: 'cancelled' }> => {
        transcriptionSignal = options?.signal
        return await workflowResult
      }
    )
    const destroyPasteService = vi.fn()
    const destroyOverlayPublisher = vi.fn()
    const orchestrator = new DictationPipelineOrchestrator({
      commandBus: {} as never,
      sessionBus: {} as never,
      artifactBus: {} as never,
      recordingService: {} as never,
      overlayPublisher: {
        publishImmediate: vi.fn(async (): Promise<void> => undefined),
        destroy: destroyOverlayPublisher
      } as never,
      session: new DictationSessionStateManager(),
      idleReset: {
        clear: vi.fn(),
        schedule: vi.fn(),
        destroy: vi.fn()
      } as never,
      transcriptionWorkflow: { processArtifact } as never,
      pasteService: {
        cancelActiveFallback: vi.fn(),
        destroy: destroyPasteService
      } as never,
      storageRepository: {} as never
    })
    ;(orchestrator as unknown as { initialized: boolean }).initialized = true

    const handleArtifactReady = (
      orchestrator as unknown as {
        handleArtifactReady: (artifact: RecordingArtifact) => Promise<void>
      }
    ).handleArtifactReady(artifact)
    await vi.waitFor(() => expect(processArtifact).toHaveBeenCalledTimes(1))

    const shutdown = orchestrator.shutdown()
    await Promise.resolve()

    expect(transcriptionSignal?.aborted).toBe(true)
    expect(destroyPasteService).not.toHaveBeenCalled()
    expect(destroyOverlayPublisher).not.toHaveBeenCalled()

    resolveWorkflow?.({ type: 'cancelled' })
    await Promise.all([handleArtifactReady, shutdown])

    expect(destroyPasteService).toHaveBeenCalledTimes(1)
    expect(destroyOverlayPublisher).toHaveBeenCalledTimes(1)
  })
})
