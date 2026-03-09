import type { DictationFailureReason, DictationRuntimeStateResponse } from '../../shared/dictation'
import type { RecordingArtifact, RecordingMode } from '../../shared/recording'
import type { DictationPasteService, ManualPasteState } from '../paste/service'
import type { RecordingCommand, RecordingCommandBus } from '../recording/command-bus'
import type { RecordingArtifactBus } from '../recording/artifact-bus'
import type { RecordingServiceOrchestrator } from '../recording/service/orchestrator'
import type { RecordingSessionSnapshot } from '../recording/service/session'
import type { RecordingSessionBus } from '../recording/session-bus'
import { resolveDictationCommandIntent } from './command-intent'
import type { DictationIdleResetController } from './idle-reset-controller'
import type { DictationOverlayPublisher } from './overlay-publisher'
import type { DictationSessionStateManager } from './session'
import { resolveTerminalDisplayDelayMs } from './terminal-policy'
import type { DictationTranscriptionWorkflow } from './transcription-workflow'

/**
 * Coordinates top-level dictation lifecycle in main process.
 *
 * Responsibilities:
 * - consumes command and recording session events,
 * - drives terminal/transcribing transitions,
 * - delegates state mutations to DictationSessionStateManager,
 * - delegates side effects to dedicated collaborators.
 */
export class DictationPipelineOrchestrator {
  private initialized = false

  private unsubscribeCommand: (() => void) | null = null
  private unsubscribeRecordingSession: (() => void) | null = null
  private unsubscribeArtifactReady: (() => void) | null = null

  constructor(
    private readonly dependencies: {
      commandBus: RecordingCommandBus
      sessionBus: RecordingSessionBus
      artifactBus: RecordingArtifactBus
      recordingService: RecordingServiceOrchestrator
      overlayPublisher: DictationOverlayPublisher
      session: DictationSessionStateManager
      idleReset: DictationIdleResetController
      transcriptionWorkflow: DictationTranscriptionWorkflow
      pasteService: DictationPasteService
    }
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    this.initialized = true

    this.unsubscribeCommand = this.dependencies.commandBus.subscribe((command) => {
      void this.handleShortcutCommand(command).catch((error) => {
        console.error('[pipeline] failed to process shortcut command', error)
      })
    })

    this.unsubscribeRecordingSession = this.dependencies.sessionBus.subscribe((snapshot) => {
      void this.handleRecordingSessionSnapshot(snapshot).catch((error) => {
        console.error('[pipeline] failed to process recording session snapshot', error)
      })
    })

    this.unsubscribeArtifactReady = this.dependencies.artifactBus.subscribe((artifact) => {
      void this.handleArtifactReady(artifact).catch((error) => {
        console.error('[pipeline] failed to process recording artifact', error)
      })
    })

    this.dependencies.session.initializeFromRecordingRuntime(
      this.dependencies.recordingService.getRuntimeState().state
    )

    await this.publishOverlayImmediate()
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return
    }

    this.dependencies.idleReset.destroy()

    if (this.unsubscribeCommand) {
      this.unsubscribeCommand()
      this.unsubscribeCommand = null
    }

    if (this.unsubscribeRecordingSession) {
      this.unsubscribeRecordingSession()
      this.unsubscribeRecordingSession = null
    }

    if (this.unsubscribeArtifactReady) {
      this.unsubscribeArtifactReady()
      this.unsubscribeArtifactReady = null
    }

    this.dependencies.pasteService.destroy()
    this.dependencies.overlayPublisher.destroy()
    this.dependencies.session.resetToIdle()
    this.initialized = false
  }

  getRuntimeState(): DictationRuntimeStateResponse {
    return this.dependencies.session.toRuntimeStateResponse()
  }

  private async handleShortcutCommand(command: RecordingCommand): Promise<void> {
    if (!this.initialized) {
      return
    }

    const intent = resolveDictationCommandIntent(
      {
        phase: this.dependencies.session.phase,
        mode: this.dependencies.session.mode
      },
      command
    )

    if (intent.type === 'ignore') {
      return
    }

    if (intent.type === 'cancel') {
      await this.dependencies.recordingService.cancelRecording()
      return
    }

    if (intent.type === 'cancel_manual_paste') {
      this.dependencies.pasteService.cancelActiveFallback(
        this.dependencies.session.sessionId ?? undefined
      )
      return
    }

    if (intent.type === 'stop') {
      await this.dependencies.recordingService.stopRecording()
      return
    }

    await this.dependencies.recordingService.startRecording(intent.mode)
  }

  private async handleRecordingSessionSnapshot(snapshot: RecordingSessionSnapshot): Promise<void> {
    if (!this.initialized) {
      return
    }

    if (this.dependencies.session.isPhase('transcribing') && snapshot.phase === 'complete') {
      return
    }

    if (snapshot.phase === 'failed') {
      await this.transitionToFailed(
        snapshot.failureReason ?? 'capture_error',
        snapshot.message,
        snapshot.sessionId,
        snapshot.mode
      )
      return
    }

    if (snapshot.phase === 'complete') {
      await this.transitionToTranscribing(snapshot.sessionId, snapshot.mode)
      return
    }

    if (snapshot.phase === 'idle') {
      return
    }

    this.dependencies.session.applyRecordingSessionSnapshot(snapshot)

    if (snapshot.phase === 'recording') {
      await this.publishOverlayAudioLevels()
      return
    }

    await this.publishOverlayImmediate()
  }

  private async handleArtifactReady(artifact: RecordingArtifact): Promise<void> {
    if (!this.initialized) {
      return
    }

    await this.transitionToTranscribing(artifact.sessionId, artifact.mode)

    const workflowResult = await this.dependencies.transcriptionWorkflow.processArtifact(artifact)

    if (!this.dependencies.session.isCurrentSession(artifact.sessionId)) {
      return
    }

    if (workflowResult.type === 'complete') {
      await this.handlePostTranscriptionSuccess(artifact, workflowResult.transcriptText)
      return
    }

    await this.transitionToFailed(
      'transcription_error',
      workflowResult.message,
      artifact.sessionId,
      artifact.mode
    )
  }

  private async handlePostTranscriptionSuccess(
    artifact: RecordingArtifact,
    transcriptText: string
  ): Promise<void> {
    // Keep overlay visible while post-transcription paste flow resolves.
    // This avoids a hide/show blink before manual fallback or error states.
    const pasteOutcome = await this.dependencies.pasteService.processTranscript({
      sessionId: artifact.sessionId,
      transcriptText,
      onManualPasteState: async (manualState) => {
        await this.transitionToAwaitingManualPaste(artifact.sessionId, artifact.mode, manualState)
      }
    })

    if (!this.dependencies.session.isCurrentSession(artifact.sessionId)) {
      return
    }

    if (pasteOutcome.type === 'auto_paste_success') {
      await this.resetToIdleAndHideOverlay()
      return
    }

    if (
      pasteOutcome.type === 'manual_paste_success' ||
      pasteOutcome.type === 'manual_timeout' ||
      pasteOutcome.type === 'manual_cancelled'
    ) {
      await this.resetToIdleAndHideOverlay()
      return
    }

    if (pasteOutcome.type === 'not_supported') {
      await this.playErrorCueSafe()
      await this.transitionToFailed(
        'paste_not_supported',
        pasteOutcome.message,
        artifact.sessionId,
        artifact.mode
      )
      return
    }

    if (pasteOutcome.type === 'permission_denied') {
      await this.playErrorCueSafe()
      await this.transitionToFailed(
        'paste_permission_denied',
        pasteOutcome.message,
        artifact.sessionId,
        artifact.mode
      )
      return
    }

    await this.playErrorCueSafe()
    await this.transitionToFailed(
      'paste_runtime_error',
      pasteOutcome.message,
      artifact.sessionId,
      artifact.mode
    )
  }

  private async transitionToTranscribing(
    sessionId: string | null,
    mode: RecordingMode | null
  ): Promise<void> {
    if (!this.dependencies.session.setTranscribing(sessionId, mode)) {
      return
    }

    this.dependencies.idleReset.clear()
    await this.publishOverlayImmediate()
  }

  private async transitionToAwaitingManualPaste(
    sessionId: string | null,
    mode: RecordingMode | null,
    manualState: ManualPasteState
  ): Promise<void> {
    if (!sessionId || !this.dependencies.session.isCurrentSession(sessionId)) {
      return
    }

    const wasAwaitingManualPaste = this.dependencies.session.isPhase('awaiting_manual_paste')

    this.dependencies.idleReset.clear()
    this.dependencies.session.setAwaitingManualPaste({
      sessionId,
      mode,
      remainingMs: manualState.remainingMs,
      timeoutMs: manualState.timeoutMs,
      hint: manualState.hint
    })

    await this.publishOverlayImmediate()

    if (!wasAwaitingManualPaste) {
      await this.playAutoPasteFallbackCueSafe()
    }
  }

  private async transitionToFailed(
    reason: DictationFailureReason,
    message?: string,
    sessionId?: string | null,
    mode?: RecordingMode | null
  ): Promise<void> {
    this.dependencies.idleReset.clear()
    this.dependencies.session.setFailed(reason, message, sessionId, mode)

    await this.publishOverlayImmediate()
    this.scheduleTerminalReset({
      type: 'failed',
      reason,
      hasMessage: Boolean(message?.trim())
    })
  }

  private scheduleTerminalReset(
    outcome:
      | { type: 'complete' }
      | { type: 'failed'; reason: DictationFailureReason; hasMessage: boolean }
  ): void {
    const delayMs = resolveTerminalDisplayDelayMs(outcome)

    this.dependencies.idleReset.schedule(delayMs, () => {
      void this.resetToIdleAndHideOverlay().catch((error) => {
        console.error('[pipeline] failed to publish idle overlay state', error)
      })
    })
  }

  private async resetToIdleAndHideOverlay(): Promise<void> {
    this.dependencies.pasteService.cancelActiveFallback(
      this.dependencies.session.sessionId ?? undefined
    )
    this.dependencies.session.resetToIdle()
    this.dependencies.recordingService.resetSessionToIdle()
    await this.dependencies.overlayPublisher.publishImmediate(null)
  }

  private async publishOverlayImmediate(): Promise<void> {
    await this.dependencies.overlayPublisher.publishImmediate(
      this.dependencies.session.toOverlayState()
    )
  }

  private async publishOverlayAudioLevels(): Promise<void> {
    await this.dependencies.overlayPublisher.publishAudioLevels(
      this.dependencies.session.toOverlayState()
    )
  }

  private async playErrorCueSafe(): Promise<void> {
    await this.dependencies.recordingService.playCue('error').catch((error) => {
      console.error('[pipeline] failed to play paste failure cue', error)
    })
  }

  private async playAutoPasteFallbackCueSafe(): Promise<void> {
    await this.dependencies.recordingService.playCue('auto_paste_fail').catch((error) => {
      console.error('[pipeline] failed to play auto-paste fallback cue', error)
    })
  }
}
