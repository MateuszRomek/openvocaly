import {
  SHORTCUT_ACTIONS,
  type ShortcutAction,
  type ShortcutMutationResponse
} from '../../../shared/shortcuts'
import {
  areCanonicalShortcutsEqual,
  type CanonicalShortcut,
  type PersistedShortcutBinding
} from '../accelerator'
import { isShortcutAcceleratorUniqueConstraintError, setShortcutBinding } from '../repository'
import type { ShortcutActionStateMap } from '../types'

export const persistBinding = (
  action: ShortcutAction,
  binding: PersistedShortcutBinding
): ShortcutMutationResponse => {
  try {
    setShortcutBinding(action, binding)
    return { ok: true }
  } catch (error) {
    if (isShortcutAcceleratorUniqueConstraintError(error)) {
      return { ok: false, errorCode: 'duplicate_accelerator' }
    }

    return { ok: false, errorCode: 'registration_failed' }
  }
}

export const hasDuplicateAccelerator = (
  shortcutState: ShortcutActionStateMap,
  action: ShortcutAction,
  shortcut: CanonicalShortcut
): boolean =>
  SHORTCUT_ACTIONS.some((candidateAction) => {
    if (candidateAction === action) {
      return false
    }

    return areCanonicalShortcutsEqual(shortcutState[candidateAction].storedBinding, shortcut)
  })
