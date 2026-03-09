import type {
  DictationManualPasteState,
  DictationPhase,
  DictationFailureReason,
  DictationOverlayState,
  DictationRuntimeStateResponse
} from '../../shared/dictation'
import { isActiveCapturePhase, isIdlePhase } from '../../shared/lifecycle'
import type { RecordingMode, RecordingRuntimeState } from '../../shared/recording'
import type { RecordingSessionSnapshot } from '../recording/service/session'

export type DictationSessionState = {
  phase: DictationPhase
  mode: RecordingMode | null
  sessionId: string | null
  meterLevel: number
  meterBands: number[]
  failureReason?: DictationFailureReason
  message?: string
  manualPaste?: DictationManualPasteState
}

type DictationStatePatch = Partial<DictationSessionState>
type DictationPhasePatchInput = Partial<Omit<DictationSessionState, 'phase'>>

/**
 * Encapsulates dictation session state and transition-safe mutations.
 *
 * This class is intentionally side-effect free: it only reads/writes
 * in-memory state and provides serialized views for IPC/overlay layers.
 */
export class DictationSessionStateManager {
  private state: DictationSessionState = {
    phase: 'idle',
    mode: null,
    sessionId: null,
    meterLevel: 0,
    meterBands: [],
    failureReason: undefined,
    message: undefined,
    manualPaste: undefined
  }

  get phase(): DictationSessionState['phase'] {
    return this.state.phase
  }

  get mode(): DictationSessionState['mode'] {
    return this.state.mode
  }

  get sessionId(): DictationSessionState['sessionId'] {
    return this.state.sessionId
  }

  isPhase(phase: DictationSessionState['phase']): boolean {
    return this.state.phase === phase
  }

  isIdle(): boolean {
    return isIdlePhase(this.state.phase)
  }

  isStarting(mode?: RecordingMode): boolean {
    if (this.state.phase !== 'starting') {
      return false
    }

    if (!mode) {
      return true
    }

    return this.state.mode === mode
  }

  isRecording(mode?: RecordingMode): boolean {
    if (this.state.phase !== 'recording') {
      return false
    }

    if (!mode) {
      return true
    }

    return this.state.mode === mode
  }

  isCancelableCapturePhase(): boolean {
    return isActiveCapturePhase(this.state.phase)
  }

  isCurrentSession(sessionId: string): boolean {
    return this.state.sessionId === sessionId
  }

  initializeFromRecordingRuntime(runtime: RecordingRuntimeState): void {
    this.patchState({
      phase: runtime.phase,
      mode: runtime.mode,
      sessionId: runtime.sessionId,
      meterLevel: runtime.meterLevel,
      meterBands: [],
      failureReason: runtime.failureReason,
      message: runtime.message
    })
  }

  applyRecordingSessionSnapshot(snapshot: RecordingSessionSnapshot): void {
    this.patchState(
      this.toPhasePatch(snapshot.phase, {
        mode: snapshot.mode,
        sessionId: snapshot.sessionId,
        meterLevel: snapshot.meterLevel,
        meterBands: snapshot.meterBands,
        message: snapshot.message
      })
    )
  }

  setTranscribing(sessionId: string | null, mode: RecordingMode | null): boolean {
    if (!sessionId) {
      return false
    }

    this.patchState(
      this.toPhasePatch('transcribing', {
        mode,
        sessionId
      })
    )

    return true
  }

  setComplete(sessionId: string | null, mode: RecordingMode | null): void {
    this.patchState(
      this.toPhasePatch('complete', {
        mode,
        sessionId
      })
    )
  }

  setFailed(
    reason: DictationFailureReason,
    message?: string,
    sessionId: string | null = this.state.sessionId,
    mode: RecordingMode | null = this.state.mode
  ): void {
    this.patchState(
      this.toPhasePatch('failed', {
        mode,
        sessionId,
        failureReason: reason,
        message
      })
    )
  }

  setAwaitingManualPaste(
    input: {
      sessionId: string | null
      mode: RecordingMode | null
    } & DictationManualPasteState
  ): void {
    this.patchState(
      this.toPhasePatch('awaiting_manual_paste', {
        mode: input.mode,
        sessionId: input.sessionId,
        manualPaste: {
          remainingMs: input.remainingMs,
          timeoutMs: input.timeoutMs,
          hint: input.hint
        }
      })
    )
  }

  resetToIdle(): void {
    this.state = {
      phase: 'idle',
      mode: null,
      sessionId: null,
      meterLevel: 0,
      meterBands: [],
      failureReason: undefined,
      message: undefined,
      manualPaste: undefined
    }
  }

  toRuntimeStateResponse(): DictationRuntimeStateResponse {
    return {
      state: {
        phase: this.state.phase,
        mode: this.state.mode,
        sessionId: this.state.sessionId,
        meterLevel: this.state.meterLevel,
        failureReason: this.state.failureReason,
        message: this.state.message,
        manualPaste: this.state.manualPaste ? { ...this.state.manualPaste } : undefined
      }
    }
  }

  toOverlayState(): DictationOverlayState | null {
    if (this.state.phase === 'idle') {
      return null
    }

    return {
      phase: this.state.phase,
      mode: this.state.mode,
      meterLevel: this.state.meterLevel,
      bands: this.state.meterBands,
      failureReason: this.state.failureReason,
      message: this.state.message,
      manualPaste: this.state.manualPaste ? { ...this.state.manualPaste } : undefined
    }
  }

  private patchState(patch: DictationStatePatch): void {
    this.state = {
      ...this.state,
      ...patch
    }
  }

  private toPhasePatch(
    phase: DictationSessionState['phase'],
    input: DictationPhasePatchInput = {}
  ): DictationStatePatch {
    return {
      phase,
      mode: input.mode ?? null,
      sessionId: input.sessionId ?? null,
      meterLevel: input.meterLevel ?? 0,
      meterBands: input.meterBands ? [...input.meterBands] : [],
      failureReason: input.failureReason,
      message: input.message,
      manualPaste: input.manualPaste
        ? {
            remainingMs: input.manualPaste.remainingMs,
            timeoutMs: input.manualPaste.timeoutMs,
            hint: input.manualPaste.hint
          }
        : undefined
    }
  }
}

export const dictationSessionStateManager = new DictationSessionStateManager()
