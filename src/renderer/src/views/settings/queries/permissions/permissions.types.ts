export type PermissionsStatusResponse = Awaited<ReturnType<typeof window.api.permissions.getStatus>>
export type AccessibilityRequestResponse = Awaited<
  ReturnType<typeof window.api.permissions.requestAccessibility>
>
export type MicrophoneRequestResponse = Awaited<
  ReturnType<typeof window.api.permissions.requestMicrophone>
>
export type OpenSystemSettingsResponse = Awaited<
  ReturnType<typeof window.api.permissions.openAccessibilitySettings>
>

export type PermissionState = PermissionsStatusResponse['microphone']['state']
