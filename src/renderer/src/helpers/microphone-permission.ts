import type { PermissionState } from '@renderer/queries/permissions/permissions.types'

export const isMicrophoneSelectionBlocked = (state: PermissionState): boolean =>
  state === 'denied' || state === 'not_determined' || state === 'restricted'
