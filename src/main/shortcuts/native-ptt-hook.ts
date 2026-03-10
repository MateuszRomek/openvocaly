import {
  loadMacOSPttHookModule,
  type MacOSPttHookModule as NativePttHookModule,
  type NativePttHookResult
} from '../native/macos/ptt-hook-client'
import type { MacPttBinding, NativePttEvent } from './ptt-matcher'

/**
 * Thin adapter over the native macOS PTT module with runtime safety guards.
 */
export class NativePttHook {
  private readonly module: NativePttHookModule | null
  private readonly loadError: string | null
  private listening = false

  constructor() {
    const loadedModule = this.loadModule()
    this.module = loadedModule.module
    this.loadError = loadedModule.error
  }

  ensureStarted(listener: (event: NativePttEvent) => void): NativePttHookResult {
    if (!this.module) {
      return {
        ok: false,
        error: this.loadError ?? 'Native hook module unavailable'
      }
    }

    if (this.listening) {
      return { ok: true }
    }

    const result = this.module.start(listener)

    this.listening = result.ok
    return result
  }

  setBinding(binding: MacPttBinding): NativePttHookResult {
    if (!this.module) {
      return {
        ok: false,
        error: this.loadError ?? 'Native hook module unavailable'
      }
    }

    if (!this.listening) {
      return {
        ok: false,
        error: 'Native hook is not listening'
      }
    }

    return this.module.setBinding(binding)
  }

  clearBinding(): void {
    if (!this.module) {
      return
    }

    this.module.clearBinding()
  }

  stop(): void {
    if (!this.module) {
      this.listening = false
      return
    }

    this.module.clearBinding()

    if (!this.listening) {
      return
    }

    this.module.stop()
    this.listening = false
  }

  isListening(): boolean {
    return this.listening
  }

  getLoadError(): string | null {
    return this.loadError
  }

  private loadModule(): { module: NativePttHookModule | null; error: string | null } {
    return loadMacOSPttHookModule()
  }
}
