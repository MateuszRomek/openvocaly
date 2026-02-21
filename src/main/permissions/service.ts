import { shell, systemPreferences } from 'electron'
import type {
  AccessibilityRequestResponse,
  MicrophoneRequestResponse,
  OpenSystemSettingsResponse,
  PermissionsStatusResponse
} from '../../shared/permissions'

const ACCESSIBILITY_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
const MICROPHONE_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'

class PermissionsService {
  getPermissionsStatus(): PermissionsStatusResponse {
    return {
      microphone: this.getMicrophonePermissionState(),
      accessibility: this.getAccessibilityPermissionState()
    }
  }

  isAccessibilityGranted(): boolean {
    if (process.platform !== 'darwin') {
      return false
    }

    try {
      return systemPreferences.isTrustedAccessibilityClient(false)
    } catch {
      return false
    }
  }

  requestAccessibility(): AccessibilityRequestResponse {
    if (process.platform !== 'darwin') {
      return {
        ok: false,
        granted: false
      }
    }

    try {
      const granted = systemPreferences.isTrustedAccessibilityClient(true)
      return {
        ok: true,
        granted
      }
    } catch {
      return {
        ok: false,
        granted: false
      }
    }
  }

  async requestMicrophone(): Promise<MicrophoneRequestResponse> {
    if (process.platform !== 'darwin') {
      return {
        ok: false,
        granted: false
      }
    }

    try {
      const granted = await systemPreferences.askForMediaAccess('microphone')
      return {
        ok: true,
        granted
      }
    } catch {
      return {
        ok: false,
        granted: false
      }
    }
  }

  openAccessibilitySettings(): OpenSystemSettingsResponse {
    if (process.platform !== 'darwin') {
      return { ok: false }
    }

    void shell.openExternal(ACCESSIBILITY_SETTINGS_URL).catch(() => undefined)

    return { ok: true }
  }

  openMicrophoneSettings(): OpenSystemSettingsResponse {
    if (process.platform !== 'darwin') {
      return { ok: false }
    }

    void shell.openExternal(MICROPHONE_SETTINGS_URL).catch(() => undefined)

    return { ok: true }
  }

  private getMicrophonePermissionState(): PermissionsStatusResponse['microphone'] {
    if (process.platform !== 'darwin') {
      return {
        state: 'unsupported_platform',
        message: 'Microphone permission checks are currently implemented for macOS.'
      }
    }

    const status = systemPreferences.getMediaAccessStatus('microphone')

    if (status === 'granted') {
      return { state: 'granted' }
    }

    if (status === 'denied') {
      return {
        state: 'denied',
        message: 'Microphone permission is not enabled. Enable it in macOS System Settings.'
      }
    }

    if (status === 'restricted') {
      return {
        state: 'restricted',
        message: 'Microphone access is restricted by your system policy.'
      }
    }

    if (status === 'not-determined') {
      return {
        state: 'not_determined',
        message: 'Microphone permission is not enabled. Click Request access.'
      }
    }

    return {
      state: 'unknown',
      message: 'Microphone permission is not enabled. Check again or open System Settings.'
    }
  }

  private getAccessibilityPermissionState(): PermissionsStatusResponse['accessibility'] {
    if (process.platform !== 'darwin') {
      return {
        state: 'unsupported_platform',
        message: 'Accessibility permission checks are currently implemented for macOS.'
      }
    }

    const granted = this.isAccessibilityGranted()
    if (granted) {
      return {
        state: 'granted'
      }
    }

    return {
      state: 'denied',
      message:
        'Accessibility permission is not enabled. It is required for global shortcuts and auto-paste.'
    }
  }
}

export const permissionsService = new PermissionsService()
