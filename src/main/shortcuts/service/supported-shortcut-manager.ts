import { globalShortcut } from 'electron'
import { SHORTCUT_ACTIONS, type ShortcutMutationResponse } from '../../../shared/shortcuts'
import { areCanonicalShortcutsEqual, type PersistedShortcutBinding } from '../accelerator'
import type { ShortcutActionStateMap } from '../types'
import type { SupportedGlobalShortcutAction } from './global-shortcut'

type RegisterActionResult = 'ok' | 'invalid' | 'failed'

type RegisterAction = (
  action: SupportedGlobalShortcutAction,
  accelerator: string
) => RegisterActionResult

type PersistBinding = (
  action: SupportedGlobalShortcutAction,
  binding: PersistedShortcutBinding
) => ShortcutMutationResponse

/**
 * Registers supported global shortcuts during startup using persisted bindings first,
 * then falls back to defaults when possible.
 *
 * This keeps app boot resilient when stored accelerators become invalid/conflicting.
 */
export const registerSupportedShortcutsOnStartup = ({
  shortcutState,
  defaultBindingForAction,
  registerAction
}: {
  shortcutState: ShortcutActionStateMap
  defaultBindingForAction: (action: SupportedGlobalShortcutAction) => PersistedShortcutBinding
  registerAction: RegisterAction
}): { startupFailure: boolean } => {
  let startupFailure = false

  for (const action of SHORTCUT_ACTIONS) {
    if (action === 'recording.push_to_talk') {
      continue
    }

    const state = shortcutState[action]
    state.registrationError = null
    state.effectiveAccelerator = null

    const desiredBinding = state.storedBinding
    const desiredAccelerator = desiredBinding.accelerator
    const defaultBinding = defaultBindingForAction(action)
    const defaultAccelerator = defaultBinding.accelerator

    const desiredRegistration = registerAction(action, desiredAccelerator)

    if (desiredRegistration === 'ok') {
      state.effectiveAccelerator = desiredAccelerator
      continue
    }

    if (
      desiredAccelerator !== defaultAccelerator &&
      registerAction(action, defaultAccelerator) === 'ok'
    ) {
      state.effectiveAccelerator = defaultAccelerator
      state.registrationError =
        desiredRegistration === 'invalid' ? 'invalid_accelerator' : 'registration_conflict'
      startupFailure = true
      continue
    }

    state.registrationError =
      desiredRegistration === 'invalid' ? 'invalid_accelerator' : 'registration_conflict'
    state.effectiveAccelerator = null
    startupFailure = true
  }

  return { startupFailure }
}

/**
 * Applies an updated binding for supported global shortcuts as a single transaction:
 * register OS shortcut, persist DB state, and rollback registration on persistence failure.
 *
 * Returns mutation status suitable for IPC response payloads.
 */
export const applySupportedGlobalBinding = ({
  shortcutState,
  action,
  nextBinding,
  registerAction,
  persistBinding
}: {
  shortcutState: ShortcutActionStateMap
  action: SupportedGlobalShortcutAction
  nextBinding: PersistedShortcutBinding
  registerAction: RegisterAction
  persistBinding: PersistBinding
}): ShortcutMutationResponse => {
  const state = shortcutState[action]
  const previousEffective = state.effectiveAccelerator
  const previousStored = state.storedBinding

  if (
    areCanonicalShortcutsEqual(previousStored, nextBinding) &&
    previousEffective === nextBinding.accelerator
  ) {
    state.registrationError = null
    return { ok: true }
  }

  const registrationChanged = previousEffective !== nextBinding.accelerator

  if (registrationChanged && previousEffective) {
    globalShortcut.unregister(previousEffective)
  }

  if (registrationChanged) {
    const registrationResult = registerAction(action, nextBinding.accelerator)

    if (registrationResult !== 'ok') {
      if (previousEffective) {
        registerAction(action, previousEffective)
      }

      const errorCode =
        registrationResult === 'invalid' ? 'invalid_accelerator' : 'registration_conflict'
      state.registrationError = errorCode
      state.effectiveAccelerator = previousEffective
      return { ok: false, errorCode }
    }
  }

  const persistResult = persistBinding(action, nextBinding)

  if (!persistResult.ok) {
    if (registrationChanged) {
      globalShortcut.unregister(nextBinding.accelerator)

      if (previousEffective) {
        registerAction(action, previousEffective)
      }
    }

    state.registrationError =
      persistResult.errorCode === 'duplicate_accelerator'
        ? 'duplicate_accelerator'
        : 'registration_failed'
    state.effectiveAccelerator = previousEffective
    return persistResult
  }

  state.effectiveAccelerator = registrationChanged ? nextBinding.accelerator : previousEffective
  state.registrationError = null
  state.storedBinding = nextBinding

  return { ok: true }
}
