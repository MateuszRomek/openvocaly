import { createRequire } from 'node:module'
import type { ShortcutPttAvailability } from '../../shared/shortcuts'
import type { NativePttKeyEvent } from './ptt-matcher'

type NativePttHookStartResult = {
  ok: boolean
  error?: string
}

type NativePttHookModule = {
  start: (listener: (event: NativePttKeyEvent) => void) => NativePttHookStartResult
  stop: () => void
}

export type NativePttHookRuntime = {
  availability: ShortcutPttAvailability
  message?: string
  isListening: boolean
}

const isNodeModuleMissingError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes('Cannot find module')

export class NativePttHook {
  private readonly module: NativePttHookModule | null
  private readonly loadError: string | null
  private listening = false

  constructor() {
    const loadedModule = this.loadModule()
    this.module = loadedModule.module
    this.loadError = loadedModule.error
  }

  ensureStarted(listener: (event: NativePttKeyEvent) => void): NativePttHookStartResult {
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

  stop(): void {
    if (!this.module || !this.listening) {
      this.listening = false
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
    if (process.platform !== 'darwin') {
      return {
        module: null,
        error: 'Native PTT hook is only available on macOS'
      }
    }

    try {
      const requireForNative = createRequire(__filename)
      const loaded = requireForNative('@wispr/ptt-hook-macos') as NativePttHookModule
      return {
        module: loaded,
        error: null
      }
    } catch (error) {
      if (isNodeModuleMissingError(error)) {
        return {
          module: null,
          error: 'Native PTT module is not installed. Run npm install to build it.'
        }
      }

      return {
        module: null,
        error: error instanceof Error ? error.message : 'Unknown native hook load error'
      }
    }
  }
}
