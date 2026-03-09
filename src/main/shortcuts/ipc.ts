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
  initialize: () => void
  shutdown: () => void
}

/**
 * Registers shortcut IPC handlers once per process lifetime.
 */
export const createShortcutsIpcModule = (shortcutService: ShortcutService): ShortcutsIpcModule => {
  const registerIpcHandlers = createIpcRegistrar(() => {
    ipcMain.handle('shortcuts:getConfig', (): ShortcutConfigResponse => shortcutService.getConfig())

    ipcMain.handle(
      'shortcuts:update',
      (_event, params: ShortcutUpdateInput): ShortcutMutationResponse =>
        shortcutService.update(params)
    )

    ipcMain.handle(
      'shortcuts:reset',
      (_event, params?: ShortcutResetInput): ShortcutMutationResponse =>
        shortcutService.reset(params)
    )

    ipcMain.handle(
      'shortcuts:getRuntimeStatus',
      /**
       * Runtime status is separate from persisted shortcut config because
       * permission/hook readiness can change while the app is running.
       */
      (): ShortcutRuntimeStatusResponse => shortcutService.getRuntimeStatus()
    )
  })

  return {
    registerIpcHandlers,
    initialize: () => {
      shortcutService.initialize()
    },
    shutdown: () => {
      shortcutService.shutdown()
    }
  }
}
