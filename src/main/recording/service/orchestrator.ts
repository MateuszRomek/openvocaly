import { setInterval as setNodeInterval } from 'node:timers'
import type {
  RecordingArtifact,
  RecordingCaptureEvent,
  RecordingCueKind,
  RecordingFailureReason,
  RecordingMode,
  RecordingOutputFormat,
  RecordingPreferencesResponse,
  RecordingPreferencesUpdateInput,
  RecordingRuntimeStateResponse
} from '../../../shared/recording'
import { isActiveCapturePhase, isIdlePhase } from '../../../shared/lifecycle'
import type { PermissionsService } from '../../permissions/service'
import type { RecordingArtifactBus } from '../artifact-bus'
import { RecordingCaptureRuntime } from '../capture/runtime'
import { clamp01, normalizeBands } from '../core/math'
import {
  moveToComplete,
  moveToFailed,
  moveToRecording,
  moveToStarting,
  moveToStopping
} from '../core/state-machine'
import type { RecordingSessionBus } from '../session-bus'
import { RecordingArtifactManager } from '../storage/artifact-manager'
import { InitializableComponent } from '../../helpers/initializable-component'
import { routeCaptureEvent } from './capture-event-handler'
import {
  toArtifactCreationFailure,
  toCaptureRuntimeCommandFailure,
  toChunkWriteFailure,
  toFinalizeArtifactFailure
} from './failure-policy'
import { RecordingPreferencesManager } from './preferences-manager'
import {
  createRecordingSessionState,
  resetSessionLevels,
  resetSessionToIdle,
  toRecordingRuntimeStateResponse,
  toRecordingSessionSnapshot,
  type RecordingSessionState
} from './session'

const DEFAULT_OUTPUT_FORMAT: RecordingOutputFormat = 'webm_opus'
const CLEANUP_INTERVAL_MS = 12 * 60 * 60 * 1000

/**
 * Coordinates the recording lifecycle in the main process.
 *
 * Recording ownership is intentionally capture-focused only:
 * - capture start/stop/cancel transitions
 * - artifact persistence and capture failures
 * - sound cue playback
 * - runtime/session snapshots for pipeline orchestration
 */
export class RecordingServiceOrchestrator extends InitializableComponent {
  private state: RecordingSessionState = createRecordingSessionState()
  private unsubscribeCapture: (() => void) | null = null
  private cleanupInterval: NodeJS.Timeout | null = null

  private readonly captureRuntime: RecordingCaptureRuntime
  private readonly artifactManager: RecordingArtifactManager
  private readonly preferencesManager: RecordingPreferencesManager

  constructor(
    private readonly dependencies: {
      permissionsService: PermissionsService
      artifactBus: RecordingArtifactBus
      sessionBus: RecordingSessionBus
    },
    options: {
      captureRuntime?: RecordingCaptureRuntime
      artifactManager?: RecordingArtifactManager
      preferencesManager?: RecordingPreferencesManager
    } = {}
  ) {
    super('RecordingServiceOrchestrator')
    this.captureRuntime = options.captureRuntime ?? new RecordingCaptureRuntime()
    this.artifactManager = options.artifactManager ?? new RecordingArtifactManager()
    this.preferencesManager = options.preferencesManager ?? new RecordingPreferencesManager()
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    await this.preferencesManager.initialize()
    await this.artifactManager.initialize()

    this.captureRuntime.initialize()
    void this.captureRuntime.warmup().catch((error) => {
      console.error('[recording] failed to warm capture runtime', error)
    })

    this.unsubscribeCapture = this.captureRuntime.onEvent((event) => {
      void this.handleCaptureEvent(event).catch((error) => {
        this.handleUnhandledAsyncError('capture event handling failed', error)
      })
    })

    this.cleanupInterval = setNodeInterval(() => {
      void this.artifactManager.cleanupExpiredFailures().catch((error) => {
        console.error('[recording] failed to cleanup expired artifacts', error)
      })
    }, CLEANUP_INTERVAL_MS)
    this.cleanupInterval.unref()

    this.initialized = true
    this.publishSessionSnapshot()
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
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

    await this.captureRuntime.shutdown()

    resetSessionToIdle(this.state)
    this.publishSessionSnapshot()
    this.initialized = false
  }

  getRuntimeState(): RecordingRuntimeStateResponse {
    return toRecordingRuntimeStateResponse(this.state)
  }

  getPreferences(): RecordingPreferencesResponse {
    this.assertInitialized()
    return {
      preferences: this.preferencesManager.get()
    }
  }

  async updatePreferences(
    params: RecordingPreferencesUpdateInput
  ): Promise<RecordingPreferencesResponse> {
    this.assertInitialized()
    const preferences = await this.preferencesManager.update(params)

    return {
      preferences
    }
  }

  async startRecording(mode: RecordingMode): Promise<void> {
    if (!this.initialized || !isIdlePhase(this.state.machine.phase)) {
      return
    }

    const microphoneState =
      this.dependencies.permissionsService.getPermissionsStatus().microphone.state

    if (microphoneState !== 'granted') {
      await this.failCaptureSession(
        'microphone_permission_denied',
        'Microphone permission is required.'
      )
      return
    }

    try {
      this.state.activeArtifact = await this.artifactManager.createActiveArtifact(
        mode,
        DEFAULT_OUTPUT_FORMAT
      )
    } catch (error) {
      const failure = toArtifactCreationFailure(error)
      await this.failCaptureSession(failure.reason, failure.message)
      return
    }

    this.state.machine = moveToStarting(this.state.activeArtifact.artifact.sessionId, mode)
    this.publishSessionSnapshot()

    try {
      const preferences = this.preferencesManager.get()
      await this.captureRuntime.sendCommand({
        type: 'start',
        sessionId: this.state.activeArtifact.artifact.sessionId,
        format: DEFAULT_OUTPUT_FORMAT,
        soundCues: preferences.soundCues,
        preferredMicrophoneDeviceId: preferences.microphone.selectedDeviceId
      })
    } catch (error) {
      const failure = toCaptureRuntimeCommandFailure('start', error)
      await this.handleCaptureFailure(this.state.machine.sessionId, failure.reason, failure.message)
    }
  }

  async stopRecording(): Promise<void> {
    if (!this.initialized || this.state.machine.phase !== 'recording') {
      return
    }

    this.state.machine = moveToStopping(this.state.machine)
    this.publishSessionSnapshot()

    try {
      await this.captureRuntime.sendCommand({ type: 'stop' })
    } catch (error) {
      const failure = toCaptureRuntimeCommandFailure('stop', error)
      await this.handleCaptureFailure(this.state.machine.sessionId, failure.reason, failure.message)
    }
  }

  async cancelRecording(): Promise<void> {
    if (!this.initialized) {
      return
    }

    const activeArtifact = this.state.activeArtifact
    if (!isActiveCapturePhase(this.state.machine.phase) || !activeArtifact) {
      return
    }

    try {
      await this.captureRuntime.sendCommand({
        type: 'cancel',
        reason: 'aborted',
        soundCues: this.preferencesManager.get().soundCues
      })
    } catch (error) {
      const failure = toCaptureRuntimeCommandFailure('cancel', error)
      await this.handleCaptureFailure(this.state.machine.sessionId, failure.reason, failure.message)
    }
  }

  async playCue(cue: RecordingCueKind): Promise<void> {
    const soundCues = this.preferencesManager.get().soundCues
    if (!soundCues.enabled) {
      return
    }

    try {
      await this.captureRuntime.sendCommand({
        type: 'playCue',
        cue,
        soundCues
      })
    } catch (error) {
      console.error('[recording] failed to play cue', error)
    }
  }

  resetSessionToIdle(): void {
    if (this.state.activeArtifact) {
      return
    }

    if (isActiveCapturePhase(this.state.machine.phase)) {
      return
    }

    resetSessionToIdle(this.state)
    this.publishSessionSnapshot()
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
          this.publishSessionSnapshot()
        },
        onDeviceResolved: async ({ sessionId, deviceId }) => {
          const activeArtifact = this.state.activeArtifact
          if (!activeArtifact || activeArtifact.artifact.sessionId !== sessionId) {
            return
          }
          await this.persistResolvedMicrophoneDevice(deviceId)
        },
        onAudioLevels: async ({ sessionId, level, bands }) => {
          const activeArtifact = this.state.activeArtifact
          if (!activeArtifact || activeArtifact.artifact.sessionId !== sessionId) {
            return
          }

          this.state.meterLevel = clamp01(level)
          this.state.meterBands = normalizeBands(bands)
          this.publishSessionSnapshot()
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

    this.dependencies.artifactBus.emit(finalizedArtifact)
    this.state.activeArtifact = null
    this.state.machine = moveToComplete(this.state.machine)
    resetSessionLevels(this.state)
    this.publishSessionSnapshot()
  }

  private async handleCaptureFailure(
    sessionId: string | null,
    reason: RecordingFailureReason,
    message?: string
  ): Promise<void> {
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

    this.state.machine = moveToFailed(this.state.machine, reason, message)
    resetSessionLevels(this.state)
    this.publishSessionSnapshot()
  }

  private async failCaptureSession(
    reason: RecordingFailureReason,
    message?: string
  ): Promise<void> {
    this.state.machine = moveToFailed(this.state.machine, reason, message)
    resetSessionLevels(this.state)
    this.publishSessionSnapshot()
  }

  private async persistFailureArtifact(
    artifact: RecordingArtifact,
    reason: RecordingFailureReason,
    message?: string
  ): Promise<void> {
    try {
      await this.artifactManager.markFailure(artifact, reason, message)
    } catch (error) {
      console.error('[recording] failed to persist failure artifact', error)
    }
  }

  private async persistResolvedMicrophoneDevice(deviceId: string | null): Promise<void> {
    const currentDeviceId = this.preferencesManager.get().microphone.selectedDeviceId

    if (currentDeviceId === deviceId) {
      return
    }

    try {
      await this.preferencesManager.update({
        microphone: {
          selectedDeviceId: deviceId
        }
      })
    } catch (error) {
      console.error('[recording] failed to persist resolved microphone device', error)
    }
  }

  private publishSessionSnapshot(): void {
    this.dependencies.sessionBus.emit(toRecordingSessionSnapshot(this.state))
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
