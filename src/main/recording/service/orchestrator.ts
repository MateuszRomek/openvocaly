import { setInterval as setNodeInterval, setTimeout as setNodeTimeout } from 'node:timers'
import type {
  RecordingArtifact,
  RecordingCaptureEvent,
  RecordingFailureReason,
  RecordingMode,
  RecordingOutputFormat,
  RecordingPreferencesResponse,
  RecordingPreferencesUpdateInput,
  RecordingRuntimeStateResponse
} from '../../../shared/recording'
import { isMacOS } from '../../helpers/platform'
import { permissionsService } from '../../permissions/service'
import { recordingCommandBus, type RecordingCommand } from '../command-bus'
import { RecordingCaptureRuntime } from '../capture/runtime'
import { clamp01, normalizeBands } from '../core/math'
import {
  moveToComplete,
  moveToFailed,
  moveToRecording,
  moveToStarting,
  moveToStopping
} from '../core/state-machine'
import { recordingArtifactBus } from '../artifact-bus'
import { RecordingArtifactStore } from '../storage/artifact-store'
import { resolveRecordingCommandIntent } from './command-handler'
import { routeCaptureEvent } from './capture-event-handler'
import {
  resolveCompleteDisplayDelayMs,
  resolveFailureDisplayDelayMs,
  toArtifactCreationFailure,
  toCaptureRuntimeCommandFailure,
  toChunkWriteFailure,
  toFinalizeArtifactFailure
} from './failure-policy'
import { RecordingOverlayPublisher } from './overlay-publisher'
import { RecordingPreferencesStore } from './preferences-store'
import {
  createRecordingSessionState,
  resetSessionLevels,
  resetSessionToIdle,
  toRecordingOverlayState,
  toRecordingRuntimeStateResponse,
  type RecordingSessionState
} from './session'

const DEFAULT_OUTPUT_FORMAT: RecordingOutputFormat = 'webm_opus'
const CLEANUP_INTERVAL_MS = 12 * 60 * 60 * 1000

type TerminalStateOutcome =
  | { type: 'complete' }
  | {
      type: 'failed'
      reason: RecordingFailureReason
      message?: string
    }

/**
 * Module ownership:
 * - Owns recording session lifecycle orchestration and terminal-state resolution.
 * - Does not own low-level capture IPC transport, overlay window internals, or DB schema logic.
 */
/**
 * Coordinates the full recording lifecycle in the main process.
 *
 * Invariants:
 * - Only one active recording artifact exists at a time.
 * - Every recording session ends in `complete` or `failed` before returning to `idle`.
 * - Overlay updates are emitted from machine state, never mutated independently.
 */
export class RecordingServiceOrchestrator {
  private state: RecordingSessionState = createRecordingSessionState()
  private initialized = false
  private unsubscribeCommand: (() => void) | null = null
  private unsubscribeCapture: (() => void) | null = null
  private cleanupInterval: NodeJS.Timeout | null = null
  private idleResetTimeout: NodeJS.Timeout | null = null

  private readonly captureRuntime = new RecordingCaptureRuntime()
  private readonly artifactStore = new RecordingArtifactStore()
  private readonly overlayPublisher = new RecordingOverlayPublisher()
  private readonly preferencesStore = new RecordingPreferencesStore()

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    await this.preferencesStore.initialize()
    await this.artifactStore.initialize()

    this.captureRuntime.initialize()
    void this.captureRuntime.warmup().catch((error) => {
      console.error('[recording] failed to warm capture runtime', error)
    })
    this.unsubscribeCapture = this.captureRuntime.onEvent((event) => {
      void this.handleCaptureEvent(event).catch((error) => {
        this.handleUnhandledAsyncError('capture event handling failed', error)
      })
    })

    this.unsubscribeCommand = recordingCommandBus.subscribe((command) => {
      void this.handleShortcutCommand(command).catch((error) => {
        this.handleUnhandledAsyncError('shortcut command handling failed', error)
      })
    })

    this.cleanupInterval = setNodeInterval(() => {
      void this.artifactStore.cleanupExpiredFailures().catch((error) => {
        console.error('[recording] failed to cleanup expired artifacts', error)
      })
    }, CLEANUP_INTERVAL_MS)
    this.cleanupInterval.unref()

    this.initialized = true
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return
    }

    this.clearIdleResetTimer()

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    if (this.unsubscribeCommand) {
      this.unsubscribeCommand()
      this.unsubscribeCommand = null
    }

    if (this.unsubscribeCapture) {
      this.unsubscribeCapture()
      this.unsubscribeCapture = null
    }

    const activeArtifact = this.state.activeArtifact
    if (activeArtifact) {
      this.state.activeArtifact = null

      try {
        await activeArtifact.abort()
      } catch (error) {
        console.error('[recording] failed to abort artifact during shutdown', error)
      }

      await this.persistFailureArtifact(activeArtifact.artifact, 'aborted', 'Application shutdown.')
    }

    this.overlayPublisher.destroy()
    await this.captureRuntime.shutdown()

    resetSessionToIdle(this.state)
    this.initialized = false
  }

  getRuntimeState(): RecordingRuntimeStateResponse {
    return toRecordingRuntimeStateResponse(this.state)
  }

  getPreferences(): RecordingPreferencesResponse {
    return {
      preferences: this.preferencesStore.get()
    }
  }

  async updatePreferences(
    input: RecordingPreferencesUpdateInput
  ): Promise<RecordingPreferencesResponse> {
    const preferences = await this.preferencesStore.update(input)

    return {
      preferences
    }
  }

  private async handleShortcutCommand(command: RecordingCommand): Promise<void> {
    const intent = resolveRecordingCommandIntent({
      command,
      machine: this.state.machine,
      hasActiveArtifact: this.state.activeArtifact !== null,
      isInitialized: this.initialized,
      isMacOS: isMacOS()
    })

    if (intent.type === 'ignore') {
      return
    }

    if (intent.type === 'cancel') {
      await this.cancelRecording()
      return
    }

    if (intent.type === 'begin') {
      await this.beginRecording(intent.mode)
      return
    }

    await this.stopRecording()
  }

  private async cancelRecording(): Promise<void> {
    const activeArtifact = this.state.activeArtifact
    const isCancelablePhase =
      this.state.machine.phase === 'starting' ||
      this.state.machine.phase === 'recording' ||
      this.state.machine.phase === 'stopping'

    if (!isCancelablePhase || !activeArtifact) {
      return
    }

    this.clearIdleResetTimer()

    try {
      await this.captureRuntime.sendCommand({
        type: 'cancel',
        reason: 'aborted',
        soundCues: this.preferencesStore.get().soundCues
      })
    } catch (error) {
      const failure = toCaptureRuntimeCommandFailure('cancel', error)
      await this.handleCaptureFailure(this.state.machine.sessionId, failure.reason, failure.message)
    }
  }

  private async beginRecording(mode: RecordingMode): Promise<void> {
    this.clearIdleResetTimer()

    const microphoneState = permissionsService.getPermissionsStatus().microphone.state

    if (microphoneState !== 'granted') {
      await this.failAndReset('microphone_permission_denied', 'Microphone permission is required.')
      return
    }

    try {
      this.state.activeArtifact = await this.artifactStore.createActiveArtifact(
        mode,
        DEFAULT_OUTPUT_FORMAT
      )
    } catch (error) {
      const failure = toArtifactCreationFailure(error)
      await this.failAndReset(failure.reason, failure.message)
      return
    }

    this.state.machine = moveToStarting(this.state.activeArtifact.artifact.sessionId, mode)
    await this.publishOverlayImmediate()

    try {
      await this.captureRuntime.sendCommand({
        type: 'start',
        sessionId: this.state.activeArtifact.artifact.sessionId,
        format: DEFAULT_OUTPUT_FORMAT,
        soundCues: this.preferencesStore.get().soundCues
      })
    } catch (error) {
      const failure = toCaptureRuntimeCommandFailure('start', error)
      await this.handleCaptureFailure(this.state.machine.sessionId, failure.reason, failure.message)
    }
  }

  private async stopRecording(): Promise<void> {
    if (this.state.machine.phase !== 'recording') {
      return
    }

    this.state.machine = moveToStopping(this.state.machine)
    await this.publishOverlayImmediate()

    try {
      await this.captureRuntime.sendCommand({ type: 'stop' })
    } catch (error) {
      const failure = toCaptureRuntimeCommandFailure('stop', error)
      await this.handleCaptureFailure(this.state.machine.sessionId, failure.reason, failure.message)
    }
  }

  private async handleCaptureEvent(event: RecordingCaptureEvent): Promise<void> {
    if (!this.initialized) {
      return
    }

    await routeCaptureEvent({
      event,
      activeSessionId: this.state.activeArtifact?.artifact.sessionId ?? null,
      delegates: {
        onChunk: async ({ sessionId, chunk }) => {
          const activeArtifact = this.state.activeArtifact
          if (!activeArtifact || activeArtifact.artifact.sessionId !== sessionId) {
            return
          }

          try {
            await activeArtifact.writeChunk(chunk)
          } catch (error) {
            const failure = toChunkWriteFailure(error)
            await this.handleCaptureFailure(sessionId, failure.reason, failure.message)
          }
        },
        onStarted: async ({ sessionId }) => {
          const activeArtifact = this.state.activeArtifact
          if (!activeArtifact || activeArtifact.artifact.sessionId !== sessionId) {
            return
          }

          if (this.state.machine.phase !== 'starting') {
            return
          }

          this.state.machine = moveToRecording(this.state.machine)
          await this.publishOverlayImmediate()
        },
        onAudioLevels: async ({ sessionId, level, bands }) => {
          const activeArtifact = this.state.activeArtifact
          if (!activeArtifact || activeArtifact.artifact.sessionId !== sessionId) {
            return
          }

          this.state.meterLevel = clamp01(level)
          this.state.meterBands = normalizeBands(bands)
          await this.publishOverlayAudioLevels()
        },
        onStopped: async ({ sessionId, durationMs }) => {
          await this.finalizeAndPublishArtifact(sessionId, durationMs)
        },
        onFailure: async ({ sessionId, reason, message }) => {
          await this.handleCaptureFailure(sessionId, reason, message)
        }
      }
    })
  }

  /**
   * Finalization guarantee:
   * - Finalize artifact bytes and publish completed artifact for downstream pipeline processing.
   * - Session always resolves to complete/failed and schedules idle reset.
   */
  private async finalizeAndPublishArtifact(sessionId: string, durationMs: number): Promise<void> {
    if (!this.state.activeArtifact || this.state.activeArtifact.artifact.sessionId !== sessionId) {
      return
    }

    let finalizedArtifact = this.state.activeArtifact.artifact

    try {
      finalizedArtifact = await this.state.activeArtifact.finalize(durationMs)
    } catch (error) {
      const failure = toFinalizeArtifactFailure(error)
      await this.handleCaptureFailure(sessionId, failure.reason, failure.message)
      return
    }

    recordingArtifactBus.emit(finalizedArtifact)
    this.state.activeArtifact = null
    await this.settleTerminalState({ type: 'complete' })
  }

  private async handleCaptureFailure(
    sessionId: string | null,
    reason: RecordingFailureReason,
    message?: string
  ): Promise<void> {
    // Failure path contract:
    // - best-effort abort of active writer
    // - best-effort failure artifact persistence
    // - always settle machine to terminal failed state
    const activeArtifact = this.state.activeArtifact
    if (activeArtifact) {
      const activeSessionId = activeArtifact.artifact.sessionId

      if (!sessionId || sessionId === activeSessionId) {
        this.state.activeArtifact = null

        try {
          await activeArtifact.abort()
        } catch (error) {
          console.error('[recording] failed to abort active artifact', error)
        }

        await this.persistFailureArtifact(activeArtifact.artifact, reason, message)
      }
    }

    await this.settleTerminalState({ type: 'failed', reason, message })
  }

  private async failAndReset(reason: RecordingFailureReason, message?: string): Promise<void> {
    await this.settleTerminalState({ type: 'failed', reason, message })
  }

  /**
   * Centralized terminal transition: updates machine, resets levels, publishes overlay,
   * and schedules return to idle according to success/failure policy.
   */
  private async settleTerminalState(outcome: TerminalStateOutcome): Promise<void> {
    if (outcome.type === 'complete') {
      this.state.machine = moveToComplete(this.state.machine)
      resetSessionLevels(this.state)
      await this.publishOverlayImmediate()
      this.scheduleIdleReset(resolveCompleteDisplayDelayMs())
      return
    }

    this.state.machine = moveToFailed(this.state.machine, outcome.reason, outcome.message)
    resetSessionLevels(this.state)
    await this.publishOverlayImmediate()
    this.scheduleIdleReset(resolveFailureDisplayDelayMs(outcome.reason))
  }

  private scheduleIdleReset(delayMs: number): void {
    this.clearIdleResetTimer()

    this.idleResetTimeout = setNodeTimeout(() => {
      resetSessionToIdle(this.state)
      void this.overlayPublisher.publishImmediate(null).catch((error) => {
        console.error('[recording] failed to publish idle overlay state', error)
      })
    }, delayMs)
    this.idleResetTimeout.unref()
  }

  private clearIdleResetTimer(): void {
    if (!this.idleResetTimeout) {
      return
    }

    clearTimeout(this.idleResetTimeout)
    this.idleResetTimeout = null
  }

  private async publishOverlayImmediate(): Promise<void> {
    await this.overlayPublisher.publishImmediate(toRecordingOverlayState(this.state))
  }

  private async publishOverlayAudioLevels(): Promise<void> {
    await this.overlayPublisher.publishAudioLevels(toRecordingOverlayState(this.state))
  }

  private async persistFailureArtifact(
    artifact: RecordingArtifact,
    reason: RecordingFailureReason,
    message?: string
  ): Promise<void> {
    try {
      await this.artifactStore.markFailure(artifact, reason, message)
    } catch (error) {
      console.error('[recording] failed to persist failure artifact', error)
    }
  }

  private handleUnhandledAsyncError(context: string, error: unknown): void {
    console.error(`[recording] ${context}`, error)

    if (!this.initialized) {
      return
    }

    const message = error instanceof Error ? error.message : 'Unexpected recording pipeline error.'

    void this.handleCaptureFailure(this.state.machine.sessionId, 'capture_error', message).catch(
      (recoveryError) => {
        console.error('[recording] failed to recover from async pipeline error', recoveryError)
      }
    )
  }
}

export const recordingService = new RecordingServiceOrchestrator()
