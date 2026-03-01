import { permissionsService } from '../../permissions/service'
import { isMacOS } from '../../helpers/platform'
import { emitRecordingShortcutEvent } from '../recording-events'
import { createMacPttBinding, type NativePttEvent } from '../ptt-matcher'
import { NativePttHook } from '../native-ptt-hook'
import type { ShortcutActionStateMap } from '../types'
import type {
  ShortcutMutationResponse,
  ShortcutRuntimeStatusResponse
} from '../../../shared/shortcuts'
import type { PersistedShortcutBinding } from '../accelerator'
import { persistBinding } from './persistence'

type PttHoldState = 'idle' | 'holding'

/**
 * Module ownership:
 * - Owns native push-to-talk hook lifecycle/readiness and hold-state semantics.
 * - Does not own user-level shortcut decision routing or supported global shortcuts.
 */
/**
 * Encapsulates push-to-talk native hook lifecycle, runtime readiness, and
 * transactional binding apply/rollback behavior.
 */
export class PttRuntimeManager {
  private readonly nativePttHook = new NativePttHook()
  private pttHoldState: PttHoldState = 'idle'
  private pttBinding: ReturnType<typeof createMacPttBinding> = null
  private pttEffectiveAccelerator: string | null = null

  private pttRuntimeStatus: ShortcutRuntimeStatusResponse['ptt'] = {
    availability: 'unsupported_platform',
    isListening: false
  }

  constructor(private readonly getShortcutState: () => ShortcutActionStateMap) {}

  resetForStartup(): void {
    this.pttHoldState = 'idle'
    this.pttBinding = null
    this.pttEffectiveAccelerator = null
  }

  shutdown(): void {
    this.releasePushToTalkHoldIfNeeded()
    this.nativePttHook.clearBinding()
    this.nativePttHook.stop()
  }

  /**
   * Initializes PTT desired binding from persisted state and refreshes runtime availability.
   * Returns whether startup should be flagged as degraded due to invalid persisted binding.
   */
  initializeOnStartup(defaultBinding: PersistedShortcutBinding): { startupFailure: boolean } {
    const state = this.getShortcutState()['recording.push_to_talk']
    const desiredBinding = createMacPttBinding(state.storedBinding)

    let startupFailure = false

    if (desiredBinding) {
      this.pttBinding = desiredBinding
      this.pttEffectiveAccelerator = state.storedBinding.accelerator
      state.registrationError = null
    } else {
      const fallbackBinding = createMacPttBinding(defaultBinding)
      this.pttBinding = fallbackBinding
      this.pttEffectiveAccelerator = fallbackBinding ? defaultBinding.accelerator : null
      state.registrationError = 'invalid_accelerator'
      startupFailure = true
    }

    this.refreshRuntimeStatus()
    return { startupFailure }
  }

  refreshRuntimeStatus(): void {
    const state = this.getShortcutState()['recording.push_to_talk']
    const loadError = this.nativePttHook.getLoadError()

    if (!isMacOS()) {
      this.nativePttHook.clearBinding()
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
      this.nativePttHook.clearBinding()
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
      this.nativePttHook.clearBinding()
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
      this.nativePttHook.clearBinding()
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

    if (this.pttBinding) {
      const setBindingResult = this.nativePttHook.setBinding(this.pttBinding)

      if (!setBindingResult.ok) {
        this.nativePttHook.clearBinding()
        this.nativePttHook.stop()
        this.releasePushToTalkHoldIfNeeded()
        this.pttRuntimeStatus = {
          availability: 'hook_init_failed',
          message: setBindingResult.error ?? 'Failed to apply native push-to-talk binding.',
          isListening: false
        }
        state.effectiveAccelerator = null
        state.registrationError = 'hook_init_failed'
        return
      }
    } else {
      this.nativePttHook.clearBinding()
    }

    this.pttRuntimeStatus = {
      availability: 'ready',
      isListening: true
    }

    if (state.registrationError === 'hook_init_failed') {
      state.registrationError = null
    }

    state.effectiveAccelerator = this.pttBinding ? this.pttEffectiveAccelerator : null
  }

  getRuntimeStatus(): ShortcutRuntimeStatusResponse['ptt'] {
    return {
      ...this.pttRuntimeStatus
    }
  }

  isReady(): boolean {
    return (
      this.pttRuntimeStatus.availability === 'ready' &&
      this.nativePttHook.isListening() &&
      this.pttBinding !== null
    )
  }

  /**
   * Applies a new PTT binding transactionally:
   * 1) set native binding (when active),
   * 2) persist DB binding,
   * 3) rollback native binding when persistence fails.
   */
  applyBinding(nextBinding: PersistedShortcutBinding): ShortcutMutationResponse {
    const binding = createMacPttBinding(nextBinding)
    const state = this.getShortcutState()['recording.push_to_talk']

    if (!binding) {
      return { ok: false, errorCode: 'invalid_accelerator' }
    }

    const wasReady = this.isReady()
    const previousBinding = this.pttBinding

    if (wasReady) {
      this.releasePushToTalkHoldIfNeeded()
      const setBindingResult = this.nativePttHook.setBinding(binding)

      if (!setBindingResult.ok) {
        state.registrationError = 'hook_init_failed'
        return { ok: false, errorCode: 'hook_init_failed' }
      }
    }

    const persistResult = persistBinding('recording.push_to_talk', nextBinding)

    if (!persistResult.ok) {
      if (wasReady) {
        if (previousBinding) {
          const rollbackResult = this.nativePttHook.setBinding(previousBinding)

          if (!rollbackResult.ok) {
            this.nativePttHook.clearBinding()
            this.nativePttHook.stop()
            this.releasePushToTalkHoldIfNeeded()
            this.pttRuntimeStatus = {
              availability: 'hook_init_failed',
              message:
                rollbackResult.error ?? 'Failed to restore previous native push-to-talk binding.',
              isListening: false
            }
            state.effectiveAccelerator = null
            state.registrationError = 'hook_init_failed'
          }
        } else {
          this.nativePttHook.clearBinding()
        }
      }

      return persistResult
    }

    state.storedBinding = nextBinding
    state.registrationError = null
    this.pttBinding = binding
    this.pttEffectiveAccelerator = nextBinding.accelerator
    state.effectiveAccelerator = this.isReady() ? this.pttEffectiveAccelerator : null

    return { ok: true }
  }

  applyStoredBindingWithoutRegistration(binding: PersistedShortcutBinding): void {
    const state = this.getShortcutState()['recording.push_to_talk']
    state.storedBinding = binding
    state.registrationError = null

    this.pttBinding = createMacPttBinding(binding)
    this.pttEffectiveAccelerator = this.pttBinding ? binding.accelerator : null
    state.effectiveAccelerator = this.isReady() ? this.pttEffectiveAccelerator : null
  }

  releasePushToTalkHoldIfNeeded(options?: { emitStop?: boolean }): void {
    if (this.pttHoldState !== 'holding') {
      return
    }

    this.pttHoldState = 'idle'
    if (options?.emitStop ?? true) {
      emitRecordingShortcutEvent('push_to_talk_stop')
    }
  }

  private handlePushToTalkEvent = (event: NativePttEvent): void => {
    if (!this.isReady() || !this.pttBinding) {
      return
    }

    if (event.type === 'push_to_talk_start') {
      if (this.pttHoldState === 'holding') {
        return
      }

      this.pttHoldState = 'holding'
      emitRecordingShortcutEvent('push_to_talk_start')
      return
    }

    if (this.pttHoldState !== 'holding') {
      return
    }

    this.pttHoldState = 'idle'
    emitRecordingShortcutEvent('push_to_talk_stop')
  }
}
