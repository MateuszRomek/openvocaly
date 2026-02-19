import type { ShortcutAction } from '../../shared/shortcuts'
import type { ShortcutActionStateMap } from './types'

export const SUPPORTED_GLOBAL_ACTIONS = new Set<ShortcutAction>(['recording.toggle'])

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
  bindings: Record<ShortcutAction, string>
): ShortcutActionStateMap => ({
  'recording.toggle': {
    storedAccelerator: bindings['recording.toggle'],
    effectiveAccelerator: null,
    registrationError: null
  },
  'recording.push_to_talk': {
    storedAccelerator: bindings['recording.push_to_talk'],
    effectiveAccelerator: null,
    registrationError: null
  }
})
