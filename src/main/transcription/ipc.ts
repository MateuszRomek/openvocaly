import { ipcMain } from 'electron'
import type {
  TranscriptionPreferencesResponse,
  TranscriptionPreferencesUpdateInput,
  TranscriptionProviderApiKeyClearInput,
  TranscriptionProviderApiKeyMutationResponse,
  TranscriptionProviderApiKeyUpdateInput
} from '../../shared/transcription'
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

  transcriptionIpcRegistered = true
}

export const initializeTranscription = (): Promise<void> => transcriptionService.initialize()

export const shutdownTranscription = (): Promise<void> => transcriptionService.shutdown()
