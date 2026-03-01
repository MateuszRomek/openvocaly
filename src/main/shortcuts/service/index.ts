import { globalShortcut } from 'electron'
import { initDb } from '../../db'
import { emitRecordingShortcutEvent } from '../recording-events'
import { ensureDefaultShortcutBindings, listShortcutBindings } from '../repository'
import {
  type ShortcutAction,
  type ShortcutConfigResponse,
  type ShortcutMutationResponse,
  type ShortcutResetInput,
  type ShortcutRuntimeStatusResponse,
  type ShortcutUpdateInput
} from '../../../shared/shortcuts'
import { createInitialShortcutState } from '../constants'
import {
  parseAccelerator,
  toPersistedShortcutBinding,
  type PersistedShortcutBinding
} from '../accelerator'
import type { ShortcutActionStateMap } from '../types'
import { selectShortcutConfigResponse } from './shortcut-config-selector'
import { createDefaultBindings, defaultBindingForAction } from './defaults'
import { tryRegisterAction, type SupportedGlobalShortcutAction } from './global-shortcut'
import { hasDuplicateAccelerator, persistBinding } from './persistence'
import {
  decideShortcutReset,
  decideShortcutUpdate,
  type ShortcutResetOperation
} from './shortcut-service-reducer'
import { PttRuntimeManager } from './ptt-runtime-manager'
import {
  applySupportedGlobalBinding,
  registerSupportedShortcutsOnStartup
} from './supported-shortcut-manager'

/**
 * Module ownership:
 * - Owns shortcut service lifecycle and high-level mutation orchestration.
 * - Does not own native PTT hook runtime internals or supported-global transaction internals.
 */
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
    return selectShortcutConfigResponse(
      this.shortcutState,
      this.pttRuntime.isReady(),
      this.startupFailure
    )
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
    this.pttRuntime.refreshRuntimeStatus()

    const parsedShortcut = parseAccelerator(input.accelerator)
    const binding = parsedShortcut ? toPersistedShortcutBinding(parsedShortcut) : null
    const decision = decideShortcutUpdate({
      action: input.action,
      binding,
      hasDuplicateAccelerator: parsedShortcut
        ? hasDuplicateAccelerator(this.shortcutState, input.action, parsedShortcut)
        : false,
      pttReady: this.pttRuntime.isReady(),
      pttAvailability: this.pttRuntime.getRuntimeStatus().availability
    })

    if (decision.type === 'error') {
      return { ok: false, errorCode: decision.errorCode }
    }

    if (decision.type === 'apply_ptt') {
      return this.pttRuntime.applyBinding(decision.binding)
    }

    return applySupportedGlobalBinding({
      shortcutState: this.shortcutState,
      action: decision.action,
      nextBinding: decision.binding,
      registerAction: this.registerSupportedGlobalAction,
      persistBinding
    })
  }

  reset(input?: ShortcutResetInput): ShortcutMutationResponse {
    this.ensureInitialized()
    this.pttRuntime.refreshRuntimeStatus()

    const decision = decideShortcutReset({
      action: input?.action,
      pttReady: this.pttRuntime.isReady(),
      defaultBindingForAction
    })

    if (decision.type === 'error') {
      return { ok: false, errorCode: decision.errorCode }
    }

    for (const operation of decision.operations) {
      const result = this.executeResetOperation(operation)

      if (!result.ok) {
        return result
      }
    }

    return { ok: true }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize()
    }
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

  private executeResetOperation(operation: ShortcutResetOperation): ShortcutMutationResponse {
    if (operation.type === 'apply_supported') {
      return this.applySupportedBinding(operation.action, operation.binding)
    }

    if (operation.type === 'apply_ptt') {
      return this.pttRuntime.applyBinding(operation.binding)
    }

    return this.persistStoredOnlyBinding('recording.push_to_talk', operation.binding)
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
    // Persists action binding without touching OS/global registration.
    // Used for actions that are currently unavailable at runtime (e.g. PTT not ready).
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
    state.effectiveAccelerator = binding.accelerator

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
