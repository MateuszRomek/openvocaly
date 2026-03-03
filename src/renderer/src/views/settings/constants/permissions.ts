import type { PermissionState } from '../queries/permissions/permissions.types'

export const PERMISSION_ITEMS = [
  {
    key: 'microphone',
    title: 'Microphone',
    description: 'Needed to record your voice.'
  },
  {
    key: 'accessibility',
    title: 'Accessibility',
    description: 'Needed for global push-to-talk and typing in other apps.'
  }
] as const

export const PERMISSION_STATUS_BADGE: Record<
  PermissionState,
  { label: string; variant: 'success' | 'destructive' | 'outline' }
> = {
  granted: { label: 'Enabled', variant: 'success' },
  denied: { label: 'Not granted', variant: 'destructive' },
  not_determined: { label: 'Not granted', variant: 'destructive' },
  restricted: { label: 'Not granted', variant: 'destructive' },
  unknown: { label: 'Not granted', variant: 'destructive' },
  unsupported_platform: { label: 'Unsupported', variant: 'outline' }
}

export const canRequestPermission = (state: PermissionState): boolean =>
  state === 'not_determined' || state === 'unknown'

export const canOpenPermissionSettings = (state: PermissionState): boolean =>
  state === 'denied' || state === 'restricted' || state === 'unknown'

export const shouldRenderPermissionMessage = (state: PermissionState): boolean =>
  state === 'denied' || state === 'restricted' || state === 'not_determined'
