import type { ShortcutErrorCode, ShortcutRuntimeStatusResponse } from '../../../shared/shortcuts'

export const mapPttAvailabilityToMutationError = (
  availability: ShortcutRuntimeStatusResponse['ptt']['availability']
): ShortcutErrorCode => {
  if (availability === 'permission_required') {
    return 'permission_denied'
  }

  if (availability === 'hook_init_failed') {
    return 'hook_init_failed'
  }

  return 'hook_unavailable'
}
