import { ipcMain } from 'electron'
import { createIpcRegistrar } from '../helpers/ipc'
import type {
  RecordingPreferencesResponse,
  RecordingPreferencesUpdateInput
} from '../../shared/recording'
import type { RecordingServiceOrchestrator } from './service/orchestrator'

export type RecordingIpcModule = {
  registerIpcHandlers: () => void
  initialize: () => Promise<void>
  shutdown: () => Promise<void>
}

export const createRecordingIpcModule = (
  recordingService: Pick<
    RecordingServiceOrchestrator,
    'getPreferences' | 'updatePreferences' | 'initialize' | 'shutdown'
  >
): RecordingIpcModule => {
  const registerIpcHandlers = createIpcRegistrar(() => {
    ipcMain.handle(
      'recording:getPreferences',
      (): RecordingPreferencesResponse => recordingService.getPreferences()
    )

    ipcMain.handle(
      'recording:updatePreferences',
      (_event, params: RecordingPreferencesUpdateInput): Promise<RecordingPreferencesResponse> =>
        recordingService.updatePreferences(params)
    )
  })

  return {
    registerIpcHandlers,
    initialize: () => recordingService.initialize(),
    shutdown: () => recordingService.shutdown()
  }
}
