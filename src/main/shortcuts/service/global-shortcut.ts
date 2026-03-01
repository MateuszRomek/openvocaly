import { globalShortcut } from 'electron'
import type { ShortcutAction } from '../../../shared/shortcuts'

export type SupportedGlobalShortcutAction = Extract<
  ShortcutAction,
  'recording.toggle' | 'recording.cancel'
>

export const tryRegisterAction = (
  action: SupportedGlobalShortcutAction,
  accelerator: string,
  onAction: (action: SupportedGlobalShortcutAction) => void
): 'ok' | 'invalid' | 'failed' => {
  try {
    const didRegister = globalShortcut.register(accelerator, () => {
      onAction(action)
    })

    return didRegister ? 'ok' : 'failed'
  } catch {
    return 'invalid'
  }
}
