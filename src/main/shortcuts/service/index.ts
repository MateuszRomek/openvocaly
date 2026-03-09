import { globalShortcut } from 'electron'
import type { RecordingShortcutEvent } from '../recording-events'
import {
  SHORTCUT_ACTIONS,
  type ShortcutAction,
  type ShortcutConfigResponse,
  type ShortcutMutationResponse,
  type ShortcutResetInput,
  type ShortcutRuntimeStatusResponse,
  type ShortcutUpdateInput
} from '../../../shared/shortcuts'
import { createInitialShortcutState } from '../constants'
import type { PermissionsService } from '../../permissions/service'
import { ShortcutBindingsRepository } from '../../repositories/shortcut-bindings-repository'
import {
  areCanonicalShortcutsEqual,
  parseAccelerator,
  toPersistedShortcutBinding,
  type CanonicalShortcut,
  type PersistedShortcutBinding
} from '../accelerator'
import type { ShortcutActionStateMap } from '../types'
import { selectShortcutConfigResponse } from './shortcut-config-selector'
import { createDefaultBindings, defaultBindingForAction } from './defaults'
import { tryRegisterAction, type SupportedGlobalShortcutAction } from './global-shortcut'
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
export class ShortcutService {
  private initialized = false
  private startupFailure = false
  private shortcutState: ShortcutActionStateMap =
    createInitialShortcutState(createDefaultBindings())

  private readonly pttRuntime: PttRuntimeManager
  private readonly emitRecordingShortcutEvent: (event: RecordingShortcutEvent) => void
  private readonly shortcutBindingsRepository: ShortcutBindingsRepository

  constructor(dependencies: {
    permissionsService: PermissionsService
    emitRecordingShortcutEvent?: (event: RecordingShortcutEvent) => void
    shortcutBindingsRepository?: ShortcutBindingsRepository
  }) {
    this.emitRecordingShortcutEvent = dependencies.emitRecordingShortcutEvent ?? (() => undefined)
    this.shortcutBindingsRepository =
      dependencies.shortcutBindingsRepository ?? new ShortcutBindingsRepository()
    this.pttRuntime = new PttRuntimeManager(() => this.shortcutState, {
      permissionsService: dependencies.permissionsService,
      emitRecordingShortcutEvent: this.emitRecordingShortcutEvent,
      persistBinding: (action, binding) => this.persistBinding(action, binding)
    })
  }

  initialize(): void {
    if (this.initialized) {
      return
    }

    this.shortcutBindingsRepository.ensureDefaultBindings()

    this.shortcutState = createInitialShortcutState(this.shortcutBindingsRepository.listBindings())
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

  update(params: ShortcutUpdateInput): ShortcutMutationResponse {
    this.ensureInitialized()
    this.pttRuntime.refreshRuntimeStatus()

    const parsedShortcut = parseAccelerator(params.accelerator)
    const binding = parsedShortcut ? toPersistedShortcutBinding(parsedShortcut) : null
    const decision = decideShortcutUpdate({
      action: params.action,
      binding,
      hasDuplicateAccelerator: parsedShortcut
        ? this.hasDuplicateAccelerator(params.action, parsedShortcut)
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
      persistBinding: (action, binding) => this.persistBinding(action, binding)
    })
  }

  reset(params?: ShortcutResetInput): ShortcutMutationResponse {
    this.ensureInitialized()
    this.pttRuntime.refreshRuntimeStatus()

    const decision = decideShortcutReset({
      action: params?.action,
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
      persistBinding: (nextAction, binding) => this.persistBinding(nextAction, binding)
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
    const persistResult = this.persistBinding(action, binding)

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

  private persistBinding(
    action: ShortcutAction,
    binding: PersistedShortcutBinding
  ): ShortcutMutationResponse {
    try {
      this.shortcutBindingsRepository.setBinding(action, binding)
      return { ok: true }
    } catch (error) {
      if (this.shortcutBindingsRepository.isUniqueConstraintError(error)) {
        return { ok: false, errorCode: 'duplicate_accelerator' }
      }

      return { ok: false, errorCode: 'registration_failed' }
    }
  }

  private hasDuplicateAccelerator(action: ShortcutAction, shortcut: CanonicalShortcut): boolean {
    return SHORTCUT_ACTIONS.some((candidateAction) => {
      if (candidateAction === action) {
        return false
      }

      return areCanonicalShortcutsEqual(this.shortcutState[candidateAction].storedBinding, shortcut)
    })
  }

  private handleGlobalShortcutAction = (action: SupportedGlobalShortcutAction): void => {
    if (action === 'recording.toggle') {
      this.emitRecordingShortcutEvent('toggle')
      return
    }

    this.pttRuntime.releasePushToTalkHoldIfNeeded({ emitStop: false })
    this.emitRecordingShortcutEvent('cancel')
  }
}
