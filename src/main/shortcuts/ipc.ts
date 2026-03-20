import { ipcMain } from 'electron'
import { createIpcRegistrar } from '../helpers/ipc'
import type {
  ShortcutConfigResponse,
  ShortcutMutationResponse,
  ShortcutResetInput,
  ShortcutRuntimeStatusResponse,
  ShortcutUpdateInput
} from '../../shared/shortcuts'
import type { ShortcutService } from './service'

export type ShortcutsIpcModule = {
  registerIpcHandlers: () => void
  initialize: () => Promise<void>
  shutdown: () => void
}

/**
 * Registers shortcut IPC handlers once per process lifetime.
 */
export const createShortcutsIpcModule = (shortcutService: ShortcutService): ShortcutsIpcModule => {
  const registerIpcHandlers = createIpcRegistrar(() => {
    ipcMain.handle(
      'shortcuts:getConfig',
      async (): Promise<ShortcutConfigResponse> => await shortcutService.getConfig()
    )

    ipcMain.handle(
      'shortcuts:update',
      async (_event, params: ShortcutUpdateInput): Promise<ShortcutMutationResponse> =>
        await shortcutService.update(params)
    )

    ipcMain.handle(
      'shortcuts:reset',
      async (_event, params?: ShortcutResetInput): Promise<ShortcutMutationResponse> =>
        await shortcutService.reset(params)
    )

    ipcMain.handle(
      'shortcuts:getRuntimeStatus',
      /**
       * Runtime status is separate from persisted shortcut config because
       * permission/hook readiness can change while the app is running.
       */
      async (): Promise<ShortcutRuntimeStatusResponse> => await shortcutService.getRuntimeStatus()
    )

    ipcMain.handle('shortcuts:startCaptureSession', async () => {
      await shortcutService.startShortcutCaptureSession()
    })

    ipcMain.handle('shortcuts:stopCaptureSession', async () => {
      await shortcutService.stopShortcutCaptureSession()
    })
  })

  return {
    registerIpcHandlers,
    initialize: async () => {
      await shortcutService.initialize()
    },
    shutdown: () => {
      shortcutService.shutdown()
    }
  }
}
