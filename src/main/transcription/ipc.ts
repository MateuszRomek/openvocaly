import { ipcMain } from 'electron'
import { createIpcRegistrar } from '../helpers/ipc'
import type {
  ListLocalModelsResponse,
  LocalModelActionInput,
  LocalModelActionResponse,
  LocalRuntimeStatusResponse
} from '../../shared/local-transcription'
import type {
  TranscriptionPreferencesResponse,
  TranscriptionPreferencesUpdateInput,
  TranscriptionProviderApiKeyClearInput,
  TranscriptionProviderApiKeyMutationResponse,
  TranscriptionProviderApiKeyUpdateInput
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
      'transcription:setProviderApiKey',
      (
        _event,
        params: TranscriptionProviderApiKeyUpdateInput
      ): Promise<TranscriptionProviderApiKeyMutationResponse> =>
        transcriptionService.setProviderApiKey(params)
    )

    ipcMain.handle(
      'transcription:clearProviderApiKey',
      (
        _event,
        params: TranscriptionProviderApiKeyClearInput
      ): Promise<TranscriptionProviderApiKeyMutationResponse> =>
        transcriptionService.clearProviderApiKey(params.providerId)
    )

    ipcMain.handle(
      'transcription:listLocalModels',
      (): Promise<ListLocalModelsResponse> => transcriptionService.listLocalModels()
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
      (): LocalModelActionResponse => transcriptionService.cancelLocalModelDownload()
    )

    ipcMain.handle(
      'transcription:deleteLocalModel',
      (_event, params: LocalModelActionInput): Promise<LocalModelActionResponse> =>
        transcriptionService.deleteLocalModel(params)
    )

    ipcMain.handle(
      'transcription:getLocalRuntimeStatus',
      (): LocalRuntimeStatusResponse => transcriptionService.getLocalRuntimeStatus()
    )

    ipcMain.handle(
      'transcription:startLocalRuntime',
      (_event, params: LocalModelActionInput): Promise<LocalModelActionResponse> =>
        transcriptionService.startLocalRuntime(params)
    )

    ipcMain.handle(
      'transcription:stopLocalRuntime',
      (): Promise<LocalModelActionResponse> => transcriptionService.stopLocalRuntime()
    )
  })

  return {
    registerIpcHandlers,
    initialize: () => transcriptionService.initialize(),
    shutdown: () => transcriptionService.shutdown()
  }
}
