import { ipcMain } from 'electron'
import { createIpcRegistrar } from '../helpers/ipc'
import type {
  AccessibilityRequestResponse,
  MicrophoneRequestResponse,
  OpenSystemSettingsResponse,
  PermissionsStatusResponse
} from '../../shared/permissions'
import type { PermissionsService } from './service'

export type PermissionsIpcModule = {
  registerIpcHandlers: () => void
}

export const createPermissionsIpcModule = (
  permissionsService: Pick<
    PermissionsService,
    | 'getPermissionsStatus'
    | 'requestAccessibility'
    | 'requestMicrophone'
    | 'openAccessibilitySettings'
    | 'openMicrophoneSettings'
  >
): PermissionsIpcModule => {
  const registerIpcHandlers = createIpcRegistrar(() => {
    ipcMain.handle(
      'permissions:getStatus',
      (): PermissionsStatusResponse => permissionsService.getPermissionsStatus()
    )

    ipcMain.handle(
      'permissions:requestAccessibility',
      (): AccessibilityRequestResponse => permissionsService.requestAccessibility()
    )

    ipcMain.handle(
      'permissions:requestMicrophone',
      async (): Promise<MicrophoneRequestResponse> => permissionsService.requestMicrophone()
    )

    ipcMain.handle(
      'permissions:openAccessibilitySettings',
      (): OpenSystemSettingsResponse => permissionsService.openAccessibilitySettings()
    )

    ipcMain.handle(
      'permissions:openMicrophoneSettings',
      (): OpenSystemSettingsResponse => permissionsService.openMicrophoneSettings()
    )
  })

  return {
    registerIpcHandlers
  }
}
