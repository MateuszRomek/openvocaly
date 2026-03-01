import type { ShortcutAction } from '../../shared/shortcuts'
import type { PersistedShortcutBinding } from './accelerator'
import type { ShortcutActionStateMap } from './types'

export const SUPPORTED_GLOBAL_ACTIONS = new Set<ShortcutAction>([
  'recording.toggle',
  'recording.cancel'
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
): ShortcutActionStateMap => ({
  'recording.toggle': {
    storedBinding: bindings['recording.toggle'],
    effectiveAccelerator: null,
    registrationError: null
  },
  'recording.cancel': {
    storedBinding: bindings['recording.cancel'],
    effectiveAccelerator: null,
    registrationError: null
  },
  'recording.push_to_talk': {
    storedBinding: bindings['recording.push_to_talk'],
    effectiveAccelerator: null,
    registrationError: null
  }
})
