import {
  DEFAULT_SHORTCUT_BINDINGS,
  SHORTCUT_ACTIONS,
  type ShortcutAction,
  type ShortcutActionConfig,
  type ShortcutConfigResponse
} from '../../../shared/shortcuts'
import { SUPPORTED_GLOBAL_ACTIONS } from '../constants'
import type { ShortcutActionStateMap } from '../types'

export const isShortcutActionSupportedGlobally = (
  action: ShortcutAction,
  pttReady: boolean
): boolean => {
  if (action === 'recording.push_to_talk') {
    return pttReady
  }

  return SUPPORTED_GLOBAL_ACTIONS.has(action)
}

export const selectShortcutConfigActions = (
  shortcutState: ShortcutActionStateMap,
  pttReady: boolean
): ShortcutActionConfig[] =>
  SHORTCUT_ACTIONS.map((action) => {
    const state = shortcutState[action]
    const isSupportedGlobal = isShortcutActionSupportedGlobally(action, pttReady)

    return {
      action,
      accelerator: state.storedBinding.accelerator,
      defaultAccelerator: DEFAULT_SHORTCUT_BINDINGS[action],
      effectiveAccelerator: state.effectiveAccelerator,
      isRegistered: isSupportedGlobal ? state.effectiveAccelerator !== null : false,
      isSupportedGlobal,
      registrationError: state.registrationError ?? undefined
    }
  })

export const selectShortcutConfigResponse = (
  shortcutState: ShortcutActionStateMap,
  pttReady: boolean,
  startupFailure: boolean
): ShortcutConfigResponse => ({
  actions: selectShortcutConfigActions(shortcutState, pttReady),
  hasStartupFailure: startupFailure
})
