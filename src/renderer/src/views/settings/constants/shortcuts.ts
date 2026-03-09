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
      description: 'Hold to record. Release to stop.'
    }
  }

export const SHORTCUT_ERROR_MESSAGES: Record<ShortcutErrorCode, string> = {
  invalid_accelerator: 'Invalid shortcut. Press a key, with optional modifiers.',
  duplicate_accelerator: 'That shortcut is already assigned to another action.',
  registration_conflict:
    'Could not register this shortcut. It may be used by your system or another app.',
  registration_failed: 'Could not register this shortcut. Try a different one.',
  unsupported_action: 'This action is not available right now.',
  requires_native_keyup_hook: 'Push-to-talk is not available in this build yet.',
  permission_denied: 'Allow Accessibility access to use this shortcut globally.',
  hook_unavailable: 'Push-to-talk is not available in this environment.',
  hook_init_failed: 'Push-to-talk could not start. Restart the app and try again.'
}

export const SHORTCUT_UNSUPPORTED_GLOBAL_MESSAGE =
  'This shortcut is not available in this environment.'

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
  permission_required: 'Allow Accessibility access in Permissions to use push-to-talk.',
  unsupported_platform: 'Push-to-talk is currently available only on macOS.',
  hook_init_failed: 'Push-to-talk could not start. Restart the app and try again.'
}
