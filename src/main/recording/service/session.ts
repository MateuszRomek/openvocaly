import type { RecordingRuntimeStateResponse } from '../../../shared/recording'
import {
  createInitialRecordingMachine,
  resetToIdle,
  toRuntimeState,
  type RecordingMachine
} from '../core/state-machine'
import type { ActiveArtifact } from '../storage/artifact-store'

export type RecordingSessionState = {
  machine: RecordingMachine
  meterLevel: number
  meterBands: number[]
  activeArtifact: ActiveArtifact | null
}

export type RecordingSessionSnapshot = {
  phase: RecordingMachine['phase']
  mode: RecordingMachine['mode']
  sessionId: RecordingMachine['sessionId']
  meterLevel: number
  meterBands: number[]
  activeArtifactPath: string | null
  failureReason?: RecordingMachine['failureReason']
  message?: string
}

export const createRecordingSessionState = (): RecordingSessionState => ({
  machine: createInitialRecordingMachine(),
  meterLevel: 0,
  meterBands: [],
  activeArtifact: null
})

export const resetSessionLevels = (state: RecordingSessionState): void => {
  state.meterLevel = 0
  state.meterBands = []
}

export const resetSessionToIdle = (state: RecordingSessionState): void => {
  state.machine = resetToIdle()
  resetSessionLevels(state)
  state.activeArtifact = null
}

export const toRecordingRuntimeStateResponse = (
  state: RecordingSessionState
): RecordingRuntimeStateResponse => ({
  state: toRuntimeState(
    state.machine,
    state.meterLevel,
    state.activeArtifact?.artifact.filePath ?? null
  )
})

export const toRecordingSessionSnapshot = (
  state: RecordingSessionState
): RecordingSessionSnapshot => ({
  phase: state.machine.phase,
  mode: state.machine.mode,
  sessionId: state.machine.sessionId,
  meterLevel: state.meterLevel,
  meterBands: [...state.meterBands],
  activeArtifactPath: state.activeArtifact?.artifact.filePath ?? null,
  failureReason: state.machine.failureReason,
  message: state.machine.message
})
