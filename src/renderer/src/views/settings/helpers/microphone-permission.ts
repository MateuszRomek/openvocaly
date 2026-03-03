import type { PermissionState } from '../queries/permissions/permissions.types'

export const isMicrophoneSelectionBlocked = (state: PermissionState): boolean =>
  state === 'denied' || state === 'not_determined' || state === 'restricted'
