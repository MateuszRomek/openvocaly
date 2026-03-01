import { globalShortcut } from 'electron'
import { initDb } from '../../db'
import { emitRecordingShortcutEvent } from '../recording-events'
import { ensureDefaultShortcutBindings, listShortcutBindings } from '../repository'
import {
  DEFAULT_SHORTCUT_BINDINGS,
  SHORTCUT_ACTIONS,
  isShortcutAction,
  type ShortcutAction,
  type ShortcutActionConfig,
  type ShortcutConfigResponse,
  type ShortcutMutationResponse,
  type ShortcutResetInput,
  type ShortcutRuntimeStatusResponse,
  type ShortcutUpdateInput
} from '../../../shared/shortcuts'
import { SUPPORTED_GLOBAL_ACTIONS, createInitialShortcutState } from '../constants'
import {
  parseAccelerator,
  toPersistedShortcutBinding,
  type PersistedShortcutBinding
} from '../accelerator'
import type { ShortcutActionStateMap } from '../types'
import { createDefaultBindings, defaultBindingForAction } from './defaults'
import { tryRegisterAction, type SupportedGlobalShortcutAction } from './global-shortcut'
import { hasDuplicateAccelerator, persistBinding } from './persistence'
import { mapPttAvailabilityToMutationError } from './ptt-errors'
import { PttRuntimeManager } from './ptt-runtime-manager'
import {
  applySupportedGlobalBinding,
  registerSupportedShortcutsOnStartup
} from './supported-shortcut-manager'

/**
 * Owns shortcut lifecycle: registration, persistence integration, and PTT runtime bridging.
 */
class ShortcutService {
  private initialized = false
  private startupFailure = false
  private shortcutState: ShortcutActionStateMap =
    createInitialShortcutState(createDefaultBindings())

  private readonly pttRuntime = new PttRuntimeManager(() => this.shortcutState)

  initialize(): void {
    if (this.initialized) {
      return
    }

    initDb()
    ensureDefaultShortcutBindings()

    this.shortcutState = createInitialShortcutState(listShortcutBindings())
    this.startupFailure = false
    this.pttRuntime.resetForStartup()

    globalShortcut.unregisterAll()
    this.startupFailure =
      this.startupFailure ||
      registerSupportedShortcutsOnStartup({
        shortcutState: this.shortcutState,
        defaultBindingForAction,
        registerAction: this.registerSupportedGlobalAction
      }).startupFailure
    this.startupFailure =
      this.startupFailure ||
      this.pttRuntime.initializeOnStartup(defaultBindingForAction('recording.push_to_talk'))
        .startupFailure

    this.initialized = true
  }

  shutdown(): void {
    this.pttRuntime.shutdown()
    globalShortcut.unregisterAll()
    this.initialized = false
  }

  getConfig(): ShortcutConfigResponse {
    this.ensureInitialized()
    this.pttRuntime.refreshRuntimeStatus()

    const actions: ShortcutActionConfig[] = SHORTCUT_ACTIONS.map((action) => {
      const isSupportedGlobal = this.isSupportedGlobalAction(action)
      const state = this.shortcutState[action]

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

    return {
      actions,
      hasStartupFailure: this.startupFailure
    }
  }

  getRuntimeStatus(): ShortcutRuntimeStatusResponse {
    this.ensureInitialized()
    this.pttRuntime.refreshRuntimeStatus()

    return {
      ptt: this.pttRuntime.getRuntimeStatus()
    }
  }

  update(input: ShortcutUpdateInput): ShortcutMutationResponse {
    this.ensureInitialized()

    const action = input.action

    if (!isShortcutAction(action)) {
      return { ok: false, errorCode: 'unsupported_action' }
    }

    const parsedShortcut = parseAccelerator(input.accelerator)

    if (!parsedShortcut) {
      return { ok: false, errorCode: 'invalid_accelerator' }
    }

    const binding = toPersistedShortcutBinding(parsedShortcut)

    if (hasDuplicateAccelerator(this.shortcutState, action, parsedShortcut)) {
      return { ok: false, errorCode: 'duplicate_accelerator' }
    }

    if (action === 'recording.push_to_talk') {
      this.pttRuntime.refreshRuntimeStatus()

      if (!this.pttRuntime.isReady()) {
        return {
          ok: false,
          errorCode: mapPttAvailabilityToMutationError(
            this.pttRuntime.getRuntimeStatus().availability
          )
        }
      }

      return this.pttRuntime.applyBinding(binding)
    }

    return applySupportedGlobalBinding({
      shortcutState: this.shortcutState,
      action,
      nextBinding: binding,
      registerAction: this.registerSupportedGlobalAction,
      persistBinding
    })
  }

  reset(input?: ShortcutResetInput): ShortcutMutationResponse {
    this.ensureInitialized()

    if (!input?.action) {
      const toggleReset = this.applySupportedBinding(
        'recording.toggle',
        defaultBindingForAction('recording.toggle')
      )

      if (!toggleReset.ok) {
        return toggleReset
      }

      const cancelReset = this.applySupportedBinding(
        'recording.cancel',
        defaultBindingForAction('recording.cancel')
      )

      if (!cancelReset.ok) {
        return cancelReset
      }

      this.pttRuntime.refreshRuntimeStatus()

      if (this.pttRuntime.isReady()) {
        return this.pttRuntime.applyBinding(defaultBindingForAction('recording.push_to_talk'))
      }

      return this.persistStoredOnlyBinding(
        'recording.push_to_talk',
        defaultBindingForAction('recording.push_to_talk')
      )
    }

    const action = input.action

    if (!isShortcutAction(action)) {
      return { ok: false, errorCode: 'unsupported_action' }
    }

    if (action === 'recording.push_to_talk') {
      this.pttRuntime.refreshRuntimeStatus()

      if (this.pttRuntime.isReady()) {
        return this.pttRuntime.applyBinding(defaultBindingForAction(action))
      }

      return this.persistStoredOnlyBinding(action, defaultBindingForAction(action))
    }

    return this.applySupportedBinding(action, defaultBindingForAction(action))
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize()
    }
  }

  private isSupportedGlobalAction(action: ShortcutAction): boolean {
    if (action === 'recording.push_to_talk') {
      return this.pttRuntime.isReady()
    }

    return SUPPORTED_GLOBAL_ACTIONS.has(action)
  }

  private applySupportedBinding(
    action: SupportedGlobalShortcutAction,
    nextBinding: PersistedShortcutBinding
  ): ShortcutMutationResponse {
    return applySupportedGlobalBinding({
      shortcutState: this.shortcutState,
      action,
      nextBinding,
      registerAction: this.registerSupportedGlobalAction,
      persistBinding
    })
  }

  private registerSupportedGlobalAction = (
    action: SupportedGlobalShortcutAction,
    accelerator: string
  ): 'ok' | 'invalid' | 'failed' =>
    tryRegisterAction(action, accelerator, this.handleGlobalShortcutAction)

  private persistStoredOnlyBinding(
    action: ShortcutAction,
    binding: PersistedShortcutBinding
  ): ShortcutMutationResponse {
    const persistResult = persistBinding(action, binding)

    if (!persistResult.ok) {
      return persistResult
    }

    if (action === 'recording.push_to_talk') {
      this.pttRuntime.applyStoredBindingWithoutRegistration(binding)
      return { ok: true }
    }

    const state = this.shortcutState[action]
    state.storedBinding = binding
    state.registrationError = null
    state.effectiveAccelerator = this.isSupportedGlobalAction(action) ? binding.accelerator : null

    return { ok: true }
  }

  private handleGlobalShortcutAction = (action: SupportedGlobalShortcutAction): void => {
    if (action === 'recording.toggle') {
      emitRecordingShortcutEvent('toggle')
      return
    }

    this.pttRuntime.releasePushToTalkHoldIfNeeded({ emitStop: false })
    emitRecordingShortcutEvent('cancel')
  }
}

export const shortcutService = new ShortcutService()
