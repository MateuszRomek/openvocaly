import { globalShortcut } from 'electron'
import { initDb } from '../db'
import { emitRecordingShortcutEvent } from './recording-events'
import {
  ensureDefaultShortcutBindings,
  isShortcutAcceleratorUniqueConstraintError,
  listShortcutBindings,
  setShortcutBinding
} from './repository'
import {
  DEFAULT_SHORTCUT_BINDINGS,
  SHORTCUT_ACTIONS,
  isShortcutAction,
  type ShortcutAction,
  type ShortcutActionConfig,
  type ShortcutConfigResponse,
  type ShortcutMutationResponse,
  type ShortcutResetInput,
  type ShortcutUpdateInput
} from '../../shared/shortcuts'
import { SUPPORTED_GLOBAL_ACTIONS, createInitialShortcutState } from './constants'
import { isValidAccelerator, normalizeAccelerator, toLower } from './accelerator'
import type { ShortcutActionStateMap } from './types'

const ACTION_HANDLERS: Record<ShortcutAction, () => void> = {
  'recording.toggle': () => emitRecordingShortcutEvent('toggle'),
  'recording.push_to_talk': () => {}
}

class ShortcutService {
  private initialized = false
  private startupFailure = false
  private shortcutState: ShortcutActionStateMap =
    createInitialShortcutState(DEFAULT_SHORTCUT_BINDINGS)

  initialize(): void {
    if (this.initialized) {
      return
    }

    initDb()
    ensureDefaultShortcutBindings()

    this.shortcutState = createInitialShortcutState(listShortcutBindings())
    this.startupFailure = false

    globalShortcut.unregisterAll()
    this.registerShortcutsOnStartup()

    this.initialized = true
  }

  shutdown(): void {
    globalShortcut.unregisterAll()
    this.initialized = false
  }

  getConfig(): ShortcutConfigResponse {
    this.ensureInitialized()

    const actions: ShortcutActionConfig[] = SHORTCUT_ACTIONS.map((action) => {
      const isSupportedGlobal = this.isSupportedGlobalAction(action)
      const state = this.shortcutState[action]

      return {
        action,
        accelerator: state.storedAccelerator,
        defaultAccelerator: DEFAULT_SHORTCUT_BINDINGS[action],
        effectiveAccelerator: isSupportedGlobal ? state.effectiveAccelerator : null,
        isRegistered: isSupportedGlobal ? state.effectiveAccelerator !== null : false,
        isSupportedGlobal,
        registrationError: state.registrationError ?? undefined
      }
    })

    return {
      actions,
      hasStartupFailure: this.startupFailure
    }
  }

  update(input: ShortcutUpdateInput): ShortcutMutationResponse {
    this.ensureInitialized()

    const action = input.action

    if (!isShortcutAction(action)) {
      return { ok: false, errorCode: 'unsupported_action' }
    }

    if (!this.isSupportedGlobalAction(action)) {
      return { ok: false, errorCode: 'requires_native_keyup_hook' }
    }

    const accelerator = normalizeAccelerator(input.accelerator)

    if (!accelerator || !isValidAccelerator(accelerator)) {
      return { ok: false, errorCode: 'invalid_accelerator' }
    }

    if (this.hasDuplicateAccelerator(action, accelerator)) {
      return { ok: false, errorCode: 'duplicate_accelerator' }
    }

    return this.applySupportedBinding(action, accelerator)
  }

  reset(input?: ShortcutResetInput): ShortcutMutationResponse {
    this.ensureInitialized()

    if (!input?.action) {
      const toggleReset = this.applySupportedBinding(
        'recording.toggle',
        DEFAULT_SHORTCUT_BINDINGS['recording.toggle']
      )

      if (!toggleReset.ok) {
        return toggleReset
      }

      return this.persistStoredOnlyBinding(
        'recording.push_to_talk',
        DEFAULT_SHORTCUT_BINDINGS['recording.push_to_talk']
      )
    }

    const action = input.action

    if (!isShortcutAction(action)) {
      return { ok: false, errorCode: 'unsupported_action' }
    }

    if (this.isSupportedGlobalAction(action)) {
      return this.applySupportedBinding(action, DEFAULT_SHORTCUT_BINDINGS[action])
    }

    return this.persistStoredOnlyBinding(action, DEFAULT_SHORTCUT_BINDINGS[action])
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize()
    }
  }

  private isSupportedGlobalAction(action: ShortcutAction): boolean {
    return SUPPORTED_GLOBAL_ACTIONS.has(action)
  }

  /**
   * Registers supported actions at startup and falls back to defaults when custom
   * values fail. This keeps launch resilient even when shortcuts conflict at OS level.
   */
  private registerShortcutsOnStartup(): void {
    for (const action of SHORTCUT_ACTIONS) {
      const state = this.shortcutState[action]
      state.registrationError = null
      state.effectiveAccelerator = null

      if (!this.isSupportedGlobalAction(action)) {
        continue
      }

      const desiredAccelerator = state.storedAccelerator
      const defaultAccelerator = DEFAULT_SHORTCUT_BINDINGS[action]

      const desiredRegistration = this.tryRegisterAction(action, desiredAccelerator)

      if (desiredRegistration === 'ok') {
        state.effectiveAccelerator = desiredAccelerator
        continue
      }

      if (
        desiredAccelerator !== defaultAccelerator &&
        this.tryRegisterAction(action, defaultAccelerator) === 'ok'
      ) {
        state.effectiveAccelerator = defaultAccelerator
        state.registrationError =
          desiredRegistration === 'invalid' ? 'invalid_accelerator' : 'registration_conflict'
        this.startupFailure = true
        continue
      }

      state.registrationError =
        desiredRegistration === 'invalid' ? 'invalid_accelerator' : 'registration_conflict'
      state.effectiveAccelerator = null
      this.startupFailure = true
    }
  }

  private applySupportedBinding(
    action: ShortcutAction,
    nextAccelerator: string
  ): ShortcutMutationResponse {
    /**
     * Update strategy:
     * 1) Unregister previous effective shortcut (if needed)
     * 2) Try register next shortcut
     * 3) Persist to DB only after successful registration
     * 4) Roll back registration if persistence fails
     */
    const state = this.shortcutState[action]
    const previousEffective = state.effectiveAccelerator
    const previousStored = state.storedAccelerator

    if (
      toLower(previousStored) === toLower(nextAccelerator) &&
      previousEffective &&
      toLower(previousEffective) === toLower(nextAccelerator)
    ) {
      state.registrationError = null
      return { ok: true }
    }

    const registrationChanged = previousEffective !== nextAccelerator

    if (registrationChanged && previousEffective) {
      globalShortcut.unregister(previousEffective)
    }

    if (registrationChanged) {
      const registrationResult = this.tryRegisterAction(action, nextAccelerator)

      if (registrationResult !== 'ok') {
        if (previousEffective) {
          this.tryRegisterAction(action, previousEffective)
        }

        const errorCode =
          registrationResult === 'invalid' ? 'invalid_accelerator' : 'registration_conflict'
        state.registrationError = errorCode
        state.effectiveAccelerator = previousEffective
        return { ok: false, errorCode }
      }
    }

    const persistResult = this.persistBinding(action, nextAccelerator)

    if (!persistResult.ok) {
      if (registrationChanged) {
        globalShortcut.unregister(nextAccelerator)

        if (previousEffective) {
          this.tryRegisterAction(action, previousEffective)
        }
      }

      state.registrationError =
        persistResult.errorCode === 'duplicate_accelerator'
          ? 'duplicate_accelerator'
          : 'registration_failed'
      state.effectiveAccelerator = previousEffective
      return persistResult
    }

    state.effectiveAccelerator = registrationChanged ? nextAccelerator : previousEffective
    state.registrationError = null
    state.storedAccelerator = nextAccelerator

    return { ok: true }
  }

  private persistStoredOnlyBinding(
    action: ShortcutAction,
    accelerator: string
  ): ShortcutMutationResponse {
    const persistResult = this.persistBinding(action, accelerator)

    if (!persistResult.ok) {
      return persistResult
    }

    this.shortcutState[action].storedAccelerator = accelerator
    this.shortcutState[action].registrationError = null
    return { ok: true }
  }

  private persistBinding(action: ShortcutAction, accelerator: string): ShortcutMutationResponse {
    try {
      setShortcutBinding(action, accelerator)
      return { ok: true }
    } catch (error) {
      if (isShortcutAcceleratorUniqueConstraintError(error)) {
        return { ok: false, errorCode: 'duplicate_accelerator' }
      }

      return { ok: false, errorCode: 'registration_failed' }
    }
  }

  private hasDuplicateAccelerator(action: ShortcutAction, accelerator: string): boolean {
    const nextValue = toLower(accelerator)

    return SHORTCUT_ACTIONS.some((candidateAction) => {
      if (candidateAction === action) {
        return false
      }

      return toLower(this.shortcutState[candidateAction].storedAccelerator) === nextValue
    })
  }

  private tryRegisterAction(
    action: ShortcutAction,
    accelerator: string
  ): 'ok' | 'invalid' | 'failed' {
    // Electron throws on malformed accelerators and returns false on OS-level conflicts.
    try {
      const didRegister = globalShortcut.register(accelerator, ACTION_HANDLERS[action])

      return didRegister ? 'ok' : 'failed'
    } catch {
      return 'invalid'
    }
  }
}

export const shortcutService = new ShortcutService()
