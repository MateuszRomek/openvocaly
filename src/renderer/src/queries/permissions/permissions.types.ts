import type {
  AccessibilityRequestResponse,
  MicrophoneRequestResponse,
  OpenSystemSettingsResponse,
  PermissionsStatusResponse
} from '../../../../shared/permissions'

export type {
  AccessibilityRequestResponse,
  MicrophoneRequestResponse,
  OpenSystemSettingsResponse,
  PermissionsStatusResponse
}

export type PermissionState = PermissionsStatusResponse['microphone']['state']

export const requiresPermissionsSetup = (status: PermissionsStatusResponse): boolean =>
  [status.microphone.state, status.accessibility.state].some(
    (state) => state !== 'granted' && state !== 'unsupported_platform'
  )
