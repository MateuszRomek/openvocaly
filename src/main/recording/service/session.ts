import type {
  RecordingOverlayState,
  RecordingRuntimeStateResponse
} from '../../../shared/recording'
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

export const toRecordingOverlayState = (
  state: RecordingSessionState
): RecordingOverlayState | null => {
  if (state.machine.phase === 'idle') {
    return null
  }

  return {
    phase: state.machine.phase,
    mode: state.machine.mode,
    meterLevel: state.meterLevel,
    bands: state.meterBands,
    message: state.machine.message
  }
}
