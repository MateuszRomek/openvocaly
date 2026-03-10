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
  ListTranscriptsResult,
  ResolveAppIconInput,
  ResolveAppIconResult
} from '../shared/storage'
import { AppIconResolver } from './storage/app-icon-resolver'

export type StorageIpcModule = {
  registerIpcHandlers: () => void
}

export const createStorageIpcModule = (
  storageRepository: StorageRepository,
  appIconResolver: AppIconResolver = new AppIconResolver()
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

    ipcMain.handle(
      'storage:resolveAppIcon',
      async (_event, params: ResolveAppIconInput = {}): Promise<ResolveAppIconResult> =>
        await appIconResolver.resolve(params)
    )
  })

  return {
    registerIpcHandlers
  }
}
