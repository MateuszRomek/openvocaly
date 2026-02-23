export type PermissionState =
  | 'granted'
  | 'denied'
  | 'not_determined'
  | 'restricted'
  | 'unknown'
  | 'unsupported_platform'

export type PermissionsStatusResponse = {
  microphone: {
    state: PermissionState
    message?: string
  }
  accessibility: {
    state: PermissionState
    message?: string
  }
}

export type AccessibilityRequestResponse = {
  ok: boolean
  granted: boolean
}

export type MicrophoneRequestResponse = {
  ok: boolean
  granted: boolean
}

export type OpenSystemSettingsResponse = {
  ok: boolean
}
