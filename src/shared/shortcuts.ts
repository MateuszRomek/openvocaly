export const SHORTCUT_ACTIONS = [
  'recording.toggle',
  'recording.cancel',
  'recording.push_to_talk'
] as const

export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number]

export const DEFAULT_SHORTCUT_BINDINGS: Record<ShortcutAction, string> = {
  'recording.toggle': 'CommandOrControl+Shift+Space',
  'recording.cancel': 'Escape',
  'recording.push_to_talk': 'CommandOrControl+Shift+L'
}

export type ShortcutErrorCode =
  | 'invalid_accelerator'
  | 'duplicate_accelerator'
  | 'registration_conflict'
  | 'registration_failed'
  | 'unsupported_action'
  | 'requires_native_keyup_hook'
  | 'permission_denied'
  | 'hook_unavailable'
  | 'hook_init_failed'

export type ShortcutActionConfig = {
  action: ShortcutAction
  accelerator: string
  defaultAccelerator: string
  effectiveAccelerator: string | null
  isRegistered: boolean
  isSupportedGlobal: boolean
  registrationError?: ShortcutErrorCode
}

export type ShortcutConfigResponse = {
  actions: ShortcutActionConfig[]
  hasStartupFailure: boolean
}

export type ShortcutUpdateInput = {
  action: ShortcutAction
  accelerator: string
}

export type ShortcutResetInput = {
  action?: ShortcutAction
}

export type ShortcutMutationResponse = {
  ok: boolean
  errorCode?: ShortcutErrorCode
}

export type ShortcutPttAvailability =
  | 'ready'
  | 'permission_required'
  | 'unsupported_platform'
  | 'hook_init_failed'

export type ShortcutRuntimeStatusResponse = {
  ptt: {
    availability: ShortcutPttAvailability
    message?: string
    isListening: boolean
  }
}

export const isShortcutAction = (value: string): value is ShortcutAction =>
  SHORTCUT_ACTIONS.includes(value as ShortcutAction)
