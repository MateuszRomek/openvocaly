import type { ShortcutAction, ShortcutErrorCode } from '../../shared/shortcuts'

export type ShortcutActionState = {
  storedAccelerator: string
  effectiveAccelerator: string | null
  registrationError: ShortcutErrorCode | null
}

export type ShortcutActionStateMap = Record<ShortcutAction, ShortcutActionState>
