import type { ShortcutAction, ShortcutErrorCode } from './queries/shortcuts/shortcuts.types'

export const ACTION_META: Record<ShortcutAction, { label: string; description: string }> = {
  'recording.toggle': {
    label: 'Toggle recording',
    description: 'Press once to start recording and press again to stop.'
  },
  'recording.push_to_talk': {
    label: 'Push-to-talk',
    description: 'Press and hold to record. Global key-up support is planned for Phase 2.'
  }
}

export const ERROR_MESSAGES: Record<ShortcutErrorCode, string> = {
  invalid_accelerator: 'Shortcut format is invalid. Press a modifier plus another key.',
  duplicate_accelerator: 'That shortcut is already assigned to another action.',
  registration_conflict:
    'Shortcut could not be registered. It may be reserved by the OS or another app.',
  registration_failed: 'Shortcut registration failed unexpectedly. Please try again.',
  unsupported_action: 'This action is not supported in the current phase.',
  requires_native_keyup_hook:
    'Global push-to-talk requires native key-up hooks and is not available yet.'
}

export const UNSUPPORTED_GLOBAL_MESSAGE =
  'Global push-to-talk requires native key-up hooks and is not available yet.'

export const SHORTCUT_ROW_INTERACTIVE_SURFACE_CLASS =
  'cursor-pointer hover:border-foreground/18 hover:bg-muted/12'

export const SHORTCUT_ROW_DISABLED_SURFACE_CLASS = 'cursor-default opacity-75'

export const SHORTCUT_ROW_ACTIVE_CAPTURE_CLASS =
  'border-ring/70 bg-accent/20 ring-ring/30 shadow-[0_0_0_1px_var(--color-ring)] ring-2'
