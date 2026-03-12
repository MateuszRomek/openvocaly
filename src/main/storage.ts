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
import { emitTranscriptAddedEvent } from './storage/transcript-events'

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
      async (_event, params: CreateSessionInput): Promise<CreateSessionResult> =>
        await storageRepository.createSession(params)
    )

    ipcMain.handle(
      'storage:addTranscript',
      async (_event, params: AddTranscriptInput): Promise<AddTranscriptResult> => {
        const result = await storageRepository.addTranscript(params)

        emitTranscriptAddedEvent({
          transcriptId: result.id,
          sessionId: params.sessionId,
          createdAt: params.createdAt ?? Date.now()
        })

        return result
      }
    )

    ipcMain.handle(
      'storage:listTranscripts',
      async (_event, params: ListTranscriptsInput = {}): Promise<ListTranscriptsResult> =>
        await storageRepository.listTranscripts(params)
    )

    ipcMain.handle(
      'storage:listSessions',
      async (_event, params: ListSessionsInput = {}): Promise<ListSessionsResult> =>
        await storageRepository.listSessions(params)
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
