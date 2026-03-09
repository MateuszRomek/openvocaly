import { ipcMain } from 'electron'
import { createIpcRegistrar } from './helpers/ipc'
import type { StorageRepository } from './repositories/storage-repository'
import type {
  AddTranscriptInput,
  AddTranscriptResult,
  CreateSessionInput,
  CreateSessionResult,
  ListSessionsInput,
  ListSessionsResult,
  ListTranscriptsInput,
  ListTranscriptsResult
} from '../shared/storage'

export type StorageIpcModule = {
  registerIpcHandlers: () => void
}

export const createStorageIpcModule = (
  storageRepository: Pick<
    StorageRepository,
    'createSession' | 'addTranscript' | 'listTranscripts' | 'listSessions'
  >
): StorageIpcModule => {
  const registerIpcHandlers = createIpcRegistrar(() => {
    ipcMain.handle(
      'storage:createSession',
      (_event, params: CreateSessionInput): CreateSessionResult =>
        storageRepository.createSession(params)
    )

    ipcMain.handle(
      'storage:addTranscript',
      (_event, params: AddTranscriptInput): AddTranscriptResult =>
        storageRepository.addTranscript(params)
    )

    ipcMain.handle(
      'storage:listTranscripts',
      (_event, params: ListTranscriptsInput = {}): ListTranscriptsResult =>
        storageRepository.listTranscripts(params)
    )

    ipcMain.handle(
      'storage:listSessions',
      (_event, params: ListSessionsInput = {}): ListSessionsResult =>
        storageRepository.listSessions(params)
    )
  })

  return {
    registerIpcHandlers
  }
}
