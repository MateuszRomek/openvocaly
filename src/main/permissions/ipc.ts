import { ipcMain } from 'electron'
import type {
  AccessibilityRequestResponse,
  MicrophoneRequestResponse,
  OpenSystemSettingsResponse,
  PermissionsStatusResponse
} from '../../shared/permissions'
import { permissionsService } from './service'

let permissionsIpcRegistered = false

export const registerPermissionsIpc = (): void => {
  if (permissionsIpcRegistered) {
    return
  }

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

  permissionsIpcRegistered = true
}
