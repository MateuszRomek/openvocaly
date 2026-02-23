import type { PermissionState } from '../queries/permissions/permissions.types'

export const PERMISSION_ITEMS = [
  {
    key: 'microphone',
    title: 'Microphone',
    description: 'Required to capture your voice before transcription.'
  },
  {
    key: 'accessibility',
    title: 'Accessibility',
    description: 'Required for global push-to-talk and writing text into focused inputs.'
  }
] as const

export const PERMISSION_STATUS_BADGE: Record<
  PermissionState,
  { label: string; variant: 'success' | 'destructive' | 'outline' }
> = {
  granted: { label: 'Enabled', variant: 'success' },
  denied: { label: 'Not enabled', variant: 'destructive' },
  not_determined: { label: 'Not enabled', variant: 'destructive' },
  restricted: { label: 'Not enabled', variant: 'destructive' },
  unknown: { label: 'Not enabled', variant: 'destructive' },
  unsupported_platform: { label: 'Unsupported', variant: 'outline' }
}

export const canRequestPermission = (state: PermissionState): boolean =>
  state === 'not_determined' || state === 'unknown'

export const canOpenPermissionSettings = (state: PermissionState): boolean =>
  state === 'denied' || state === 'restricted' || state === 'unknown'

export const shouldRenderPermissionMessage = (state: PermissionState): boolean =>
  state === 'denied' || state === 'restricted' || state === 'not_determined'
