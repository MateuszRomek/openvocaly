import { ipcMain } from 'electron'
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
import { transcriptionService } from './service'

let transcriptionIpcRegistered = false

export const registerTranscriptionIpc = (): void => {
  if (transcriptionIpcRegistered) {
    return
  }

  ipcMain.handle(
    'transcription:getPreferences',
    (): TranscriptionPreferencesResponse => transcriptionService.getPreferences()
  )

  ipcMain.handle(
    'transcription:updatePreferences',
    (
      _event,
      input: TranscriptionPreferencesUpdateInput
    ): Promise<TranscriptionPreferencesResponse> => transcriptionService.updatePreferences(input)
  )

  ipcMain.handle(
    'transcription:setProviderApiKey',
    (
      _event,
      input: TranscriptionProviderApiKeyUpdateInput
    ): Promise<TranscriptionProviderApiKeyMutationResponse> =>
      transcriptionService.setProviderApiKey(input)
  )

  ipcMain.handle(
    'transcription:clearProviderApiKey',
    (
      _event,
      input: TranscriptionProviderApiKeyClearInput
    ): Promise<TranscriptionProviderApiKeyMutationResponse> =>
      transcriptionService.clearProviderApiKey(input.providerId)
  )

  ipcMain.handle(
    'transcription:listLocalModels',
    (): Promise<ListLocalModelsResponse> => transcriptionService.listLocalModels()
  )

  ipcMain.handle(
    'transcription:downloadLocalModel',
    async (_event, input: LocalModelActionInput): Promise<LocalModelActionResponse> => {
      const emitProgress = createLocalDownloadProgressEmitter((progress) => {
        _event.sender.send('transcription:localModelDownloadProgress', progress)
      })

      return transcriptionService.downloadLocalModel(input, emitProgress)
    }
  )

  ipcMain.handle(
    'transcription:cancelLocalModelDownload',
    (): LocalModelActionResponse => transcriptionService.cancelLocalModelDownload()
  )

  ipcMain.handle(
    'transcription:deleteLocalModel',
    (_event, input: LocalModelActionInput): Promise<LocalModelActionResponse> =>
      transcriptionService.deleteLocalModel(input)
  )

  ipcMain.handle(
    'transcription:getLocalRuntimeStatus',
    (): LocalRuntimeStatusResponse => transcriptionService.getLocalRuntimeStatus()
  )

  ipcMain.handle(
    'transcription:startLocalRuntime',
    (_event, input: LocalModelActionInput): Promise<LocalModelActionResponse> =>
      transcriptionService.startLocalRuntime(input)
  )

  ipcMain.handle(
    'transcription:stopLocalRuntime',
    (): Promise<LocalModelActionResponse> => transcriptionService.stopLocalRuntime()
  )

  transcriptionIpcRegistered = true
}

export const initializeTranscription = (): Promise<void> => transcriptionService.initialize()

export const shutdownTranscription = (): Promise<void> => transcriptionService.shutdown()
