import type {
  RecordingFailureReason,
  RecordingMode,
  RecordingPhase,
  RecordingRuntimeState
} from '../../../shared/recording'
import { isIdlePhase } from '../../../shared/lifecycle'

export type RecordingMachine = {
  phase: RecordingPhase
  mode: RecordingMode | null
  sessionId: string | null
  failureReason?: RecordingFailureReason
  message?: string
}

export const createInitialRecordingMachine = (): RecordingMachine => ({
  phase: 'idle',
  mode: null,
  sessionId: null
})

export const toRuntimeState = (
  machine: RecordingMachine,
  meterLevel: number,
  activeArtifactPath: string | null
): RecordingRuntimeState => ({
  phase: machine.phase,
  mode: machine.mode,
  sessionId: machine.sessionId,
  meterLevel,
  activeArtifactPath,
  failureReason: machine.failureReason,
  message: machine.message
})

export const canBeginRecording = (machine: RecordingMachine): boolean => isIdlePhase(machine.phase)

export const canStopRecording = (machine: RecordingMachine): boolean =>
  machine.phase === 'recording'

export const moveToStarting = (sessionId: string, mode: RecordingMode): RecordingMachine => ({
  phase: 'starting',
  sessionId,
  mode,
  failureReason: undefined,
  message: undefined
})

export const moveToRecording = (machine: RecordingMachine): RecordingMachine => ({
  ...machine,
  phase: 'recording'
})

export const moveToStopping = (machine: RecordingMachine): RecordingMachine => ({
  ...machine,
  phase: 'stopping'
})

export const moveToComplete = (machine: RecordingMachine): RecordingMachine => ({
  ...machine,
  phase: 'complete',
  failureReason: undefined,
  message: undefined
})

export const moveToFailed = (
  machine: RecordingMachine,
  reason: RecordingFailureReason,
  message?: string
): RecordingMachine => ({
  ...machine,
  phase: 'failed',
  failureReason: reason,
  message
})

export const resetToIdle = (): RecordingMachine => ({
  phase: 'idle',
  mode: null,
  sessionId: null,
  failureReason: undefined,
  message: undefined
})
