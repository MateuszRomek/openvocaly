import type { DictationFailureReason, DictationRuntimeStateResponse } from '../../shared/dictation'
import type { RecordingArtifact, RecordingMode } from '../../shared/recording'
import { dictationPasteService } from '../paste'
import type { ManualPasteState } from '../paste/service'
import type { RecordingCommand } from '../recording/command-bus'
import { recordingCommandBus } from '../recording/command-bus'
import { recordingArtifactBus } from '../recording/artifact-bus'
import { recordingService } from '../recording/service/orchestrator'
import type { RecordingSessionSnapshot } from '../recording/service/session'
import { recordingSessionBus } from '../recording/session-bus'
import { resolveDictationCommandIntent } from './command-intent'
import { DictationIdleResetController } from './idle-reset-controller'
import { DictationOverlayPublisher } from './overlay-publisher'
import { DictationSessionStateManager } from './session'
import { resolveTerminalDisplayDelayMs } from './terminal-policy'
import { DictationTranscriptionWorkflow } from './transcription-workflow'

/**
 * Coordinates top-level dictation lifecycle in main process.
 *
 * Responsibilities:
 * - consumes command and recording session events,
 * - drives terminal/transcribing transitions,
 * - delegates state mutations to DictationSessionStateManager,
 * - delegates side effects to dedicated collaborators.
 */
class DictationPipelineOrchestrator {
  private initialized = false

  private unsubscribeCommand: (() => void) | null = null
  private unsubscribeRecordingSession: (() => void) | null = null
  private unsubscribeArtifactReady: (() => void) | null = null

  private readonly overlayPublisher = new DictationOverlayPublisher()
  private readonly session = new DictationSessionStateManager()
  private readonly idleReset = new DictationIdleResetController()
  private readonly transcriptionWorkflow = new DictationTranscriptionWorkflow()
  private readonly pasteService = dictationPasteService

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    this.initialized = true

    this.unsubscribeCommand = recordingCommandBus.subscribe((command) => {
      void this.handleShortcutCommand(command).catch((error) => {
        console.error('[pipeline] failed to process shortcut command', error)
      })
    })

    this.unsubscribeRecordingSession = recordingSessionBus.subscribe((snapshot) => {
      void this.handleRecordingSessionSnapshot(snapshot).catch((error) => {
        console.error('[pipeline] failed to process recording session snapshot', error)
      })
    })

    this.unsubscribeArtifactReady = recordingArtifactBus.subscribe((artifact) => {
      void this.handleArtifactReady(artifact).catch((error) => {
        console.error('[pipeline] failed to process recording artifact', error)
      })
    })

    this.session.initializeFromRecordingRuntime(recordingService.getRuntimeState().state)

    await this.publishOverlayImmediate()
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return
    }

    this.idleReset.destroy()

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

    this.pasteService.destroy()
    this.overlayPublisher.destroy()
    this.session.resetToIdle()
    this.initialized = false
  }

  getRuntimeState(): DictationRuntimeStateResponse {
    return this.session.toRuntimeStateResponse()
  }

  private async handleShortcutCommand(command: RecordingCommand): Promise<void> {
    if (!this.initialized) {
      return
    }

    const intent = resolveDictationCommandIntent(
      {
        phase: this.session.phase,
        mode: this.session.mode
      },
      command
    )

    if (intent.type === 'ignore') {
      return
    }

    if (intent.type === 'cancel') {
      await recordingService.cancelRecording()
      return
    }

    if (intent.type === 'cancel_manual_paste') {
      this.pasteService.cancelActiveFallback(this.session.sessionId ?? undefined)
      return
    }

    if (intent.type === 'stop') {
      await recordingService.stopRecording()
      return
    }

    await recordingService.startRecording(intent.mode)
  }

  private async handleRecordingSessionSnapshot(snapshot: RecordingSessionSnapshot): Promise<void> {
    if (!this.initialized) {
      return
    }

    if (this.session.isPhase('transcribing') && snapshot.phase === 'complete') {
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

    this.session.applyRecordingSessionSnapshot(snapshot)

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

    const workflowResult = await this.transcriptionWorkflow.processArtifact(artifact)

    if (!this.session.isCurrentSession(artifact.sessionId)) {
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
    const pasteOutcome = await this.pasteService.processTranscript({
      sessionId: artifact.sessionId,
      transcriptText,
      onManualPasteState: async (manualState) => {
        await this.transitionToAwaitingManualPaste(artifact.sessionId, artifact.mode, manualState)
      }
    })

    if (!this.session.isCurrentSession(artifact.sessionId)) {
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
    if (!this.session.setTranscribing(sessionId, mode)) {
      return
    }

    this.idleReset.clear()
    await this.publishOverlayImmediate()
  }

  private async transitionToAwaitingManualPaste(
    sessionId: string | null,
    mode: RecordingMode | null,
    manualState: ManualPasteState
  ): Promise<void> {
    if (!sessionId || !this.session.isCurrentSession(sessionId)) {
      return
    }

    const wasAwaitingManualPaste = this.session.isPhase('awaiting_manual_paste')

    this.idleReset.clear()
    this.session.setAwaitingManualPaste({
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
    this.idleReset.clear()
    this.session.setFailed(reason, message, sessionId, mode)

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

    this.idleReset.schedule(delayMs, () => {
      void this.resetToIdleAndHideOverlay().catch((error) => {
        console.error('[pipeline] failed to publish idle overlay state', error)
      })
    })
  }

  private async resetToIdleAndHideOverlay(): Promise<void> {
    this.pasteService.cancelActiveFallback(this.session.sessionId ?? undefined)
    this.session.resetToIdle()
    recordingService.resetSessionToIdle()
    await this.overlayPublisher.publishImmediate(null)
  }

  private async publishOverlayImmediate(): Promise<void> {
    await this.overlayPublisher.publishImmediate(this.session.toOverlayState())
  }

  private async publishOverlayAudioLevels(): Promise<void> {
    await this.overlayPublisher.publishAudioLevels(this.session.toOverlayState())
  }

  private async playErrorCueSafe(): Promise<void> {
    await recordingService.playCue('error').catch((error) => {
      console.error('[pipeline] failed to play paste failure cue', error)
    })
  }

  private async playAutoPasteFallbackCueSafe(): Promise<void> {
    await recordingService.playCue('auto_paste_fail').catch((error) => {
      console.error('[pipeline] failed to play auto-paste fallback cue', error)
    })
  }
}

export const dictationPipelineOrchestrator = new DictationPipelineOrchestrator()
