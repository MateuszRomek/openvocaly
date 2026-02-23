import type { ShortcutAction, ShortcutErrorCode } from '../../shared/shortcuts'
import type { PersistedShortcutBinding } from './accelerator'

export type ShortcutActionState = {
  storedBinding: PersistedShortcutBinding
  effectiveAccelerator: string | null
  registrationError: ShortcutErrorCode | null
}

export type ShortcutActionStateMap = Record<ShortcutAction, ShortcutActionState>
