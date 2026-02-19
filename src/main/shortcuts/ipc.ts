import { ipcMain } from 'electron'
import type {
  ShortcutConfigResponse,
  ShortcutMutationResponse,
  ShortcutResetInput,
  ShortcutUpdateInput
} from '../../shared/shortcuts'
import { shortcutService } from './service'

let shortcutsIpcRegistered = false

/**
 * Registers shortcut IPC handlers once per process lifetime.
 * Guarded by `shortcutsIpcRegistered` to prevent duplicate `ipcMain.handle` bindings.
 */
export const registerShortcutsIpc = (): void => {
  if (shortcutsIpcRegistered) {
    return
  }

  ipcMain.handle('shortcuts:getConfig', (): ShortcutConfigResponse => shortcutService.getConfig())

  ipcMain.handle(
    'shortcuts:update',
    (_event, input: ShortcutUpdateInput): ShortcutMutationResponse => shortcutService.update(input)
  )

  ipcMain.handle(
    'shortcuts:reset',
    (_event, input?: ShortcutResetInput): ShortcutMutationResponse => shortcutService.reset(input)
  )

  shortcutsIpcRegistered = true
}

export const initializeShortcuts = (): void => {
  shortcutService.initialize()
}

export const shutdownShortcuts = (): void => {
  shortcutService.shutdown()
}
