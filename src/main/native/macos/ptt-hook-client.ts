import { createRequire } from 'node:module'
import { isMacOS } from '../../helpers/platform'
import type { MacPttBinding, NativePttEvent } from '../../shortcuts/ptt-matcher'

export type NativePttHookResult = {
  ok: boolean
  error?: string
}

export type MacOSPttHookModule = {
  start: (listener: (event: NativePttEvent) => void) => NativePttHookResult
  stop: () => void
  setBinding: (binding: MacPttBinding) => NativePttHookResult
  clearBinding: () => void
}

const isNodeModuleMissingError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes('Cannot find module')

export const loadMacOSPttHookModule = (): {
  module: MacOSPttHookModule | null
  error: string | null
} => {
  if (!isMacOS()) {
    return {
      module: null,
      error: 'Native PTT hook is only available on macOS'
    }
  }

  try {
    const requireForNative = createRequire(__filename)
    const loaded = requireForNative('@openvocaly/ptt-hook-macos') as MacOSPttHookModule
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
