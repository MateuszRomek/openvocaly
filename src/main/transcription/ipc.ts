import { ipcMain } from 'electron'
import { createIpcRegistrar } from '../helpers/ipc'
import type {
  ListLocalModelsResponse,
  LocalModelActionInput,
  LocalModelActionResponse,
  LocalProviderActionInput,
  LocalRuntimeStatusResponse
} from '../../shared/local-transcription'
import type {
  TranscriptionPreferencesResponse,
  TranscriptionPreferencesUpdateInput
} from '../../shared/transcription'
import { createLocalDownloadProgressEmitter } from './ipc-helpers/local-model-download-progress-emitter'
import type { TranscriptionService } from './service'

export type TranscriptionIpcModule = {
  registerIpcHandlers: () => void
  initialize: () => Promise<void>
  shutdown: () => Promise<void>
}

export const createTranscriptionIpcModule = (
  transcriptionService: TranscriptionService
): TranscriptionIpcModule => {
  const registerIpcHandlers = createIpcRegistrar(() => {
    ipcMain.handle(
      'transcription:getPreferences',
      (): TranscriptionPreferencesResponse => transcriptionService.getPreferences()
    )

    ipcMain.handle(
      'transcription:updatePreferences',
      (
        _event,
        params: TranscriptionPreferencesUpdateInput
      ): Promise<TranscriptionPreferencesResponse> => transcriptionService.updatePreferences(params)
    )

    ipcMain.handle(
      'transcription:listLocalModels',
      (_event, params: LocalProviderActionInput): Promise<ListLocalModelsResponse> =>
        transcriptionService.listLocalModels(params)
    )

    ipcMain.handle(
      'transcription:downloadLocalModel',
      async (_event, params: LocalModelActionInput): Promise<LocalModelActionResponse> => {
        const emitProgress = createLocalDownloadProgressEmitter((progress) => {
          _event.sender.send('transcription:localModelDownloadProgress', progress)
        })

        return transcriptionService.downloadLocalModel(params, emitProgress)
      }
    )

    ipcMain.handle(
      'transcription:cancelLocalModelDownload',
      (_event, params: LocalProviderActionInput): LocalModelActionResponse =>
        transcriptionService.cancelLocalModelDownload(params)
    )

    ipcMain.handle(
      'transcription:deleteLocalModel',
      (_event, params: LocalModelActionInput): Promise<LocalModelActionResponse> =>
        transcriptionService.deleteLocalModel(params)
    )

    ipcMain.handle(
      'transcription:getLocalRuntimeStatus',
      (_event, params: LocalProviderActionInput): LocalRuntimeStatusResponse =>
        transcriptionService.getLocalRuntimeStatus(params)
    )

    ipcMain.handle(
      'transcription:startLocalRuntime',
      (_event, params: LocalModelActionInput): Promise<LocalModelActionResponse> =>
        transcriptionService.startLocalRuntime(params)
    )

    ipcMain.handle(
      'transcription:stopLocalRuntime',
      (_event, params: LocalProviderActionInput): Promise<LocalModelActionResponse> =>
        transcriptionService.stopLocalRuntime(params)
    )
  })

  return {
    registerIpcHandlers,
    initialize: () => transcriptionService.initialize(),
    shutdown: () => transcriptionService.shutdown()
  }
}
