import { SHORTCUT_ACTIONS, type ShortcutAction } from '../../shared/shortcuts'
import type { PersistedShortcutBinding } from './accelerator'
import type { ShortcutActionStateMap } from './types'

export const SUPPORTED_GLOBAL_ACTIONS = new Set<ShortcutAction>([
  'recording.toggle',
  'recording.cancel',
  'transcription.paste_last'
])

export const VALID_MODIFIERS = new Set([
  'CommandOrControl',
  'Command',
  'Control',
  'Ctrl',
  'Cmd',
  'Alt',
  'Option',
  'Shift',
  'Super',
  'Meta'
])

export const createInitialShortcutState = (
  bindings: Record<ShortcutAction, PersistedShortcutBinding>
): ShortcutActionStateMap =>
  SHORTCUT_ACTIONS.reduce((accumulator, action) => {
    accumulator[action] = {
      storedBinding: bindings[action],
      effectiveAccelerator: null,
      registrationError: null
    }
    return accumulator
  }, {} as ShortcutActionStateMap)
