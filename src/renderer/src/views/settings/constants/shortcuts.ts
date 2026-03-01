import type {
  ShortcutAction,
  ShortcutErrorCode,
  ShortcutPttAvailability
} from '../queries/shortcuts/shortcuts.types'

export const SHORTCUT_ACTION_META: Record<ShortcutAction, { label: string; description: string }> =
  {
    'recording.toggle': {
      label: 'Toggle recording',
      description: 'Press once to start recording and press again to stop.'
    },
    'recording.cancel': {
      label: 'Cancel recording',
      description: 'Abort an active recording session without transcribing.'
    },
    'recording.push_to_talk': {
      label: 'Push-to-talk',
      description: 'Hold to record, then release to stop.'
    }
  }

export const SHORTCUT_ERROR_MESSAGES: Record<ShortcutErrorCode, string> = {
  invalid_accelerator: 'Shortcut format is invalid. Press a key with optional modifiers.',
  duplicate_accelerator: 'That shortcut is already assigned to another action.',
  registration_conflict:
    'Shortcut could not be registered. It may be reserved by the OS or another app.',
  registration_failed: 'Shortcut registration failed unexpectedly. Please try again.',
  unsupported_action: 'This action is not supported in the current phase.',
  requires_native_keyup_hook:
    'Global push-to-talk requires native key-up hooks and is not available yet.',
  permission_denied:
    'Accessibility permission is required before this shortcut can be activated globally.',
  hook_unavailable: 'Push-to-talk native hook is unavailable in the current runtime.',
  hook_init_failed: 'Push-to-talk native hook failed to initialize.'
}

export const SHORTCUT_UNSUPPORTED_GLOBAL_MESSAGE =
  'This shortcut is not currently available in the global runtime state.'

export const SHORTCUT_ROW_INTERACTIVE_SURFACE_CLASS =
  'cursor-pointer hover:border-foreground/18 hover:bg-muted/12'

export const SHORTCUT_ROW_DISABLED_SURFACE_CLASS = 'cursor-default opacity-75'

export const SHORTCUT_ROW_ACTIVE_CAPTURE_CLASS =
  'border-ring/70 bg-accent/20 ring-ring/30 shadow-[0_0_0_1px_var(--color-ring)] ring-2'

export const PTT_STATUS_BADGE: Record<
  Exclude<ShortcutPttAvailability, 'ready'>,
  { label: string; variant: 'secondary' | 'outline' | 'destructive' }
> = {
  permission_required: { label: 'Permission', variant: 'outline' },
  unsupported_platform: { label: 'macOS only', variant: 'outline' },
  hook_init_failed: { label: 'Hook error', variant: 'destructive' }
}

export const PTT_STATUS_MESSAGE: Record<Exclude<ShortcutPttAvailability, 'ready'>, string> = {
  permission_required:
    'Accessibility permission is required. Open the Permissions section below to enable it.',
  unsupported_platform: 'Push-to-talk is currently available only on macOS.',
  hook_init_failed: 'Native hook could not start. Check logs and retry.'
}
