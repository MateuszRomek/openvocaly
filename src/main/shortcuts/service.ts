import { globalShortcut } from 'electron'
import { initDb } from '../db'
import { permissionsService } from '../permissions/service'
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
  type ShortcutErrorCode,
  type ShortcutMutationResponse,
  type ShortcutResetInput,
  type ShortcutRuntimeStatusResponse,
  type ShortcutUpdateInput
} from '../../shared/shortcuts'
import { SUPPORTED_GLOBAL_ACTIONS, createInitialShortcutState } from './constants'
import {
  areCanonicalShortcutsEqual,
  parseAccelerator,
  toPersistedShortcutBinding,
  type CanonicalShortcut,
  type PersistedShortcutBinding
} from './accelerator'
import { NativePttHook } from './native-ptt-hook'
import {
  createMacPttBinding,
  doesMacPttEventMatchBinding,
  type MacPttBinding,
  type NativePttKeyEvent
} from './ptt-matcher'
import type { ShortcutActionStateMap } from './types'

const ACTION_HANDLERS: Record<'recording.toggle', () => void> = {
  'recording.toggle': () => emitRecordingShortcutEvent('toggle')
}

type PttHoldState = 'idle' | 'holding'

const createDefaultBindings = (): Record<ShortcutAction, PersistedShortcutBinding> =>
  SHORTCUT_ACTIONS.reduce(
    (acc, action) => {
      const parsed = parseAccelerator(DEFAULT_SHORTCUT_BINDINGS[action])
      if (!parsed) {
        throw new Error(`Invalid default shortcut binding for ${action}`)
      }

      acc[action] = toPersistedShortcutBinding(parsed)
      return acc
    },
    {} as Record<ShortcutAction, PersistedShortcutBinding>
  )

class ShortcutService {
  private initialized = false
  private startupFailure = false
  private shortcutState: ShortcutActionStateMap =
    createInitialShortcutState(createDefaultBindings())

  private readonly nativePttHook = new NativePttHook()

  private pttHoldState: PttHoldState = 'idle'
  private pttBinding: MacPttBinding | null = null

  private pttRuntimeStatus: ShortcutRuntimeStatusResponse['ptt'] = {
    availability: 'unsupported_platform',
    isListening: false
  }

  initialize(): void {
    if (this.initialized) {
      return
    }

    initDb()
    ensureDefaultShortcutBindings()

    this.shortcutState = createInitialShortcutState(listShortcutBindings())
    this.startupFailure = false
    this.pttHoldState = 'idle'
    this.pttBinding = null

    globalShortcut.unregisterAll()
    this.registerShortcutsOnStartup()
    this.initializePushToTalkOnStartup()

    this.initialized = true
  }

  shutdown(): void {
    this.releasePushToTalkHoldIfNeeded()
    this.nativePttHook.stop()
    globalShortcut.unregisterAll()
    this.initialized = false
  }

  getConfig(): ShortcutConfigResponse {
    this.ensureInitialized()
    this.refreshPushToTalkRuntimeStatus()

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
    this.refreshPushToTalkRuntimeStatus()

    return {
      ptt: {
        ...this.pttRuntimeStatus
      }
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

    if (this.hasDuplicateAccelerator(action, parsedShortcut)) {
      return { ok: false, errorCode: 'duplicate_accelerator' }
    }

    if (action === 'recording.push_to_talk') {
      this.refreshPushToTalkRuntimeStatus()

      if (!this.isPushToTalkReady()) {
        return {
          ok: false,
          errorCode: this.mapPttAvailabilityToMutationError(this.pttRuntimeStatus.availability)
        }
      }

      return this.applyPushToTalkBinding(binding)
    }

    return this.applySupportedBinding(action, binding)
  }

  reset(input?: ShortcutResetInput): ShortcutMutationResponse {
    this.ensureInitialized()

    if (!input?.action) {
      const toggleReset = this.applySupportedBinding(
        'recording.toggle',
        this.defaultBindingForAction('recording.toggle')
      )

      if (!toggleReset.ok) {
        return toggleReset
      }

      this.refreshPushToTalkRuntimeStatus()

      if (this.isPushToTalkReady()) {
        return this.applyPushToTalkBinding(this.defaultBindingForAction('recording.push_to_talk'))
      }

      return this.persistStoredOnlyBinding(
        'recording.push_to_talk',
        this.defaultBindingForAction('recording.push_to_talk')
      )
    }

    const action = input.action

    if (!isShortcutAction(action)) {
      return { ok: false, errorCode: 'unsupported_action' }
    }

    if (action === 'recording.push_to_talk') {
      this.refreshPushToTalkRuntimeStatus()

      if (this.isPushToTalkReady()) {
        return this.applyPushToTalkBinding(this.defaultBindingForAction(action))
      }

      return this.persistStoredOnlyBinding(action, this.defaultBindingForAction(action))
    }

    return this.applySupportedBinding(action, this.defaultBindingForAction(action))
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize()
    }
  }

  private isSupportedGlobalAction(action: ShortcutAction): boolean {
    if (action === 'recording.push_to_talk') {
      return this.isPushToTalkReady()
    }

    return SUPPORTED_GLOBAL_ACTIONS.has(action)
  }

  private isPushToTalkReady(): boolean {
    return this.pttRuntimeStatus.availability === 'ready' && this.nativePttHook.isListening()
  }

  private initializePushToTalkOnStartup(): void {
    this.refreshPushToTalkRuntimeStatus()

    const state = this.shortcutState['recording.push_to_talk']
    const desiredAccelerator = state.storedBinding.accelerator

    const desiredBinding = createMacPttBinding(state.storedBinding)
    if (desiredBinding) {
      this.pttBinding = desiredBinding
      state.registrationError = null
    } else {
      const defaultBindingSource = this.defaultBindingForAction('recording.push_to_talk')
      const defaultBinding = createMacPttBinding(defaultBindingSource)

      this.pttBinding = defaultBinding
      state.registrationError = 'invalid_accelerator'
      this.startupFailure = true
    }

    if (this.isPushToTalkReady() && this.pttBinding) {
      state.effectiveAccelerator = desiredBinding
        ? desiredAccelerator
        : this.defaultBindingForAction('recording.push_to_talk').accelerator
      return
    }

    state.effectiveAccelerator = null
  }

  private refreshPushToTalkRuntimeStatus(): void {
    const state = this.shortcutState['recording.push_to_talk']
    const loadError = this.nativePttHook.getLoadError()

    if (process.platform !== 'darwin') {
      this.nativePttHook.stop()
      this.releasePushToTalkHoldIfNeeded()
      this.pttRuntimeStatus = {
        availability: 'unsupported_platform',
        message: 'Push-to-talk is currently available only on macOS.',
        isListening: false
      }
      if (state.registrationError === 'hook_init_failed') {
        state.registrationError = null
      }
      state.effectiveAccelerator = null
      return
    }

    if (loadError) {
      this.nativePttHook.stop()
      this.releasePushToTalkHoldIfNeeded()
      this.pttRuntimeStatus = {
        availability: 'hook_init_failed',
        message: loadError,
        isListening: false
      }
      state.effectiveAccelerator = null
      state.registrationError = 'hook_init_failed'
      return
    }

    if (!permissionsService.isAccessibilityGranted()) {
      this.nativePttHook.stop()
      this.releasePushToTalkHoldIfNeeded()
      this.pttRuntimeStatus = {
        availability: 'permission_required',
        message: 'Accessibility permission is required for global push-to-talk.',
        isListening: false
      }
      if (state.registrationError === 'hook_init_failed') {
        state.registrationError = null
      }
      state.effectiveAccelerator = null
      return
    }

    const startResult = this.nativePttHook.ensureStarted(this.handlePushToTalkEvent)

    if (!startResult.ok) {
      this.nativePttHook.stop()
      this.releasePushToTalkHoldIfNeeded()
      this.pttRuntimeStatus = {
        availability: 'hook_init_failed',
        message: startResult.error ?? 'Failed to start native push-to-talk hook.',
        isListening: false
      }
      state.effectiveAccelerator = null
      state.registrationError = 'hook_init_failed'
      return
    }

    this.pttRuntimeStatus = {
      availability: 'ready',
      isListening: true
    }

    if (state.registrationError === 'hook_init_failed') {
      state.registrationError = null
    }

    state.effectiveAccelerator = this.pttBinding ? state.storedBinding.accelerator : null
  }

  private handlePushToTalkEvent = (event: NativePttKeyEvent): void => {
    if (!this.isPushToTalkReady() || !this.pttBinding) {
      return
    }

    if (event.type === 'keydown') {
      if (!doesMacPttEventMatchBinding(event, this.pttBinding)) {
        return
      }

      if (event.isRepeat || this.pttHoldState === 'holding') {
        return
      }

      this.pttHoldState = 'holding'
      emitRecordingShortcutEvent('push_to_talk_start')
      return
    }

    if (this.pttHoldState !== 'holding') {
      return
    }

    if (event.keyCode !== this.pttBinding.keyCode) {
      return
    }

    this.pttHoldState = 'idle'
    emitRecordingShortcutEvent('push_to_talk_stop')
  }

  private releasePushToTalkHoldIfNeeded(): void {
    if (this.pttHoldState !== 'holding') {
      return
    }

    this.pttHoldState = 'idle'
    emitRecordingShortcutEvent('push_to_talk_stop')
  }

  private mapPttAvailabilityToMutationError(
    availability: ShortcutRuntimeStatusResponse['ptt']['availability']
  ): ShortcutErrorCode {
    if (availability === 'permission_required') {
      return 'permission_denied'
    }

    if (availability === 'hook_init_failed') {
      return 'hook_init_failed'
    }

    return 'hook_unavailable'
  }

  /**
   * Registers supported actions at startup and falls back to defaults when custom
   * values fail. This keeps launch resilient even when shortcuts conflict at OS level.
   */
  private registerShortcutsOnStartup(): void {
    for (const action of SHORTCUT_ACTIONS) {
      if (action !== 'recording.toggle') {
        continue
      }

      const state = this.shortcutState[action]
      state.registrationError = null
      state.effectiveAccelerator = null

      const desiredBinding = state.storedBinding
      const desiredAccelerator = desiredBinding.accelerator
      const defaultBinding = this.defaultBindingForAction(action)
      const defaultAccelerator = defaultBinding.accelerator

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
    action: 'recording.toggle',
    nextBinding: PersistedShortcutBinding
  ): ShortcutMutationResponse {
    const state = this.shortcutState[action]
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
      const registrationResult = this.tryRegisterAction(action, nextBinding.accelerator)

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

    const persistResult = this.persistBinding(action, nextBinding)

    if (!persistResult.ok) {
      if (registrationChanged) {
        globalShortcut.unregister(nextBinding.accelerator)

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

    state.effectiveAccelerator = registrationChanged ? nextBinding.accelerator : previousEffective
    state.registrationError = null
    state.storedBinding = nextBinding

    return { ok: true }
  }

  private applyPushToTalkBinding(nextBinding: PersistedShortcutBinding): ShortcutMutationResponse {
    const binding = createMacPttBinding(nextBinding)

    if (!binding) {
      return { ok: false, errorCode: 'invalid_accelerator' }
    }

    const persistResult = this.persistBinding('recording.push_to_talk', nextBinding)

    if (!persistResult.ok) {
      return persistResult
    }

    this.releasePushToTalkHoldIfNeeded()

    const state = this.shortcutState['recording.push_to_talk']
    state.storedBinding = nextBinding
    state.registrationError = null
    state.effectiveAccelerator = this.isPushToTalkReady() ? nextBinding.accelerator : null
    this.pttBinding = binding

    return { ok: true }
  }

  private persistStoredOnlyBinding(
    action: ShortcutAction,
    binding: PersistedShortcutBinding
  ): ShortcutMutationResponse {
    const persistResult = this.persistBinding(action, binding)

    if (!persistResult.ok) {
      return persistResult
    }

    const state = this.shortcutState[action]
    state.storedBinding = binding
    state.registrationError = null
    state.effectiveAccelerator = this.isSupportedGlobalAction(action) ? binding.accelerator : null

    if (action === 'recording.push_to_talk') {
      this.pttBinding = createMacPttBinding(binding)
    }

    return { ok: true }
  }

  private persistBinding(
    action: ShortcutAction,
    binding: PersistedShortcutBinding
  ): ShortcutMutationResponse {
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

  private hasDuplicateAccelerator(action: ShortcutAction, shortcut: CanonicalShortcut): boolean {
    return SHORTCUT_ACTIONS.some((candidateAction) => {
      if (candidateAction === action) {
        return false
      }

      return areCanonicalShortcutsEqual(this.shortcutState[candidateAction].storedBinding, shortcut)
    })
  }

  private defaultBindingForAction(action: ShortcutAction): PersistedShortcutBinding {
    const parsed = parseAccelerator(DEFAULT_SHORTCUT_BINDINGS[action])

    if (!parsed) {
      throw new Error(`Invalid default shortcut binding for ${action}`)
    }

    return toPersistedShortcutBinding(parsed)
  }

  private tryRegisterAction(
    action: 'recording.toggle',
    accelerator: string
  ): 'ok' | 'invalid' | 'failed' {
    try {
      const didRegister = globalShortcut.register(accelerator, ACTION_HANDLERS[action])

      return didRegister ? 'ok' : 'failed'
    } catch {
      return 'invalid'
    }
  }
}

export const shortcutService = new ShortcutService()
