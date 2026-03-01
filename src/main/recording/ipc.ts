import { ipcMain } from 'electron'
import type {
  RecordingPreferencesResponse,
  RecordingPreferencesUpdateInput,
  RecordingRuntimeStateResponse
} from '../../shared/recording'
import { recordingService } from './service/orchestrator'

let recordingIpcRegistered = false

export const registerRecordingIpc = (): void => {
  if (recordingIpcRegistered) {
    return
  }

  ipcMain.handle(
    'recording:getRuntimeState',
    (): RecordingRuntimeStateResponse => recordingService.getRuntimeState()
  )

  ipcMain.handle(
    'recording:getPreferences',
    (): RecordingPreferencesResponse => recordingService.getPreferences()
  )

  ipcMain.handle(
    'recording:updatePreferences',
    (_event, input: RecordingPreferencesUpdateInput): Promise<RecordingPreferencesResponse> =>
      recordingService.updatePreferences(input)
  )

  recordingIpcRegistered = true
}

export const initializeRecording = (): Promise<void> => recordingService.initialize()

export const shutdownRecording = (): Promise<void> => recordingService.shutdown()
