import type {
  AutoPasteProbeDecision,
  ManualPasteProbeDecision,
  PasteProbeResult
} from '../../platform-adapter'

/**
 * macOS-only decision rules for paste behavior.
 *
 * Input comes from accessibility probe fields (`frontProcessName`, `focusedRole`, `focusedSubrole`).
 * Output tells the service whether it should:
 * - try auto-paste now, or
 * - ignore a manual Cmd+V trigger because target still looks non-editable.
 */
const NON_EDITABLE_CONTAINER_ROLES = new Set([
  'axapplication',
  'axwindow',
  'axgroup',
  'axsplitgroup',
  'axscrollarea',
  'axtoolbar',
  'axbutton',
  'axstatictext',
  'axlist',
  'axlistitem',
  'axrow',
  'axcell',
  'axbrowser',
  'axtree',
  'axtabgroup',
  'axoutline'
])

const NON_EDITABLE_CONTAINER_SUBROLES = new Set(['axoutlinerow', 'axsourcelist', 'axsidebar'])

const isLikelyDesktopTarget = (probeResult: PasteProbeResult): boolean => {
  const processName = probeResult.frontProcessName?.toLowerCase()
  if (processName !== 'finder') {
    return false
  }

  const role = probeResult.focusedRole?.toLowerCase()
  return !role || role === 'axapplication' || role === 'axwindow'
}

const isLikelyExplicitNonEditableContainer = (probeResult: PasteProbeResult): boolean => {
  const role = probeResult.focusedRole?.toLowerCase()
  if (role === 'axstatictext' && isLikelyUnconfirmedWebTextSurface(probeResult)) {
    return false
  }

  if (role && NON_EDITABLE_CONTAINER_ROLES.has(role)) {
    return true
  }

  const subrole = probeResult.focusedSubrole?.toLowerCase()
  if (!subrole) {
    return false
  }

  return NON_EDITABLE_CONTAINER_SUBROLES.has(subrole)
}

const isLikelyUnconfirmedWebTextSurface = (probeResult: PasteProbeResult): boolean =>
  !probeResult.isEditable &&
  probeResult.focusedRole?.toLowerCase() === 'axstatictext' &&
  probeResult.focusedSubrole?.toLowerCase() === 'axwebapplication'

/**
 * Decides if auto-paste is safe to attempt for the current macOS focus target.
 * If not safe, returns a reason used for logs/debugging.
 */
export const evaluateMacOSAutoPasteDecision = (
  probeResult: PasteProbeResult
): AutoPasteProbeDecision => {
  if (!probeResult.ok) {
    return {
      shouldAttemptAutoPaste: false,
      reason: 'probe_failed'
    }
  }

  let reason: string | undefined
  if (probeResult.isSelfApp) {
    reason = 'self_app_target'
  } else if (isLikelyDesktopTarget(probeResult)) {
    reason = 'desktop_like_target'
  } else if (isLikelyUnconfirmedWebTextSurface(probeResult)) {
    // Some web-backed editors report static text even though Cmd+V can still land.
    reason = undefined
  } else if (!probeResult.isEditable) {
    if (isLikelyExplicitNonEditableContainer(probeResult)) {
      reason = 'non_editable_container_target'
    } else {
      reason = 'non_editable_target'
    }
  }

  return {
    shouldAttemptAutoPaste: !reason,
    reason
  }
}

/**
 * Decides if a detected manual paste shortcut should be ignored.
 * We ignore when focus still looks like non-editable container/surface.
 */
export const evaluateMacOSManualPasteDecision = (
  probeResult: PasteProbeResult
): ManualPasteProbeDecision => {
  if (!probeResult.ok) {
    return { shouldIgnoreManualPaste: false }
  }

  if (probeResult.isSelfApp) {
    return { shouldIgnoreManualPaste: true, reason: 'self_app_target' }
  }

  if (probeResult.isEditable) {
    return { shouldIgnoreManualPaste: false }
  }

  if (isLikelyDesktopTarget(probeResult)) {
    return { shouldIgnoreManualPaste: true, reason: 'desktop_target' }
  }

  if (isLikelyUnconfirmedWebTextSurface(probeResult)) {
    return { shouldIgnoreManualPaste: false }
  }

  if (isLikelyExplicitNonEditableContainer(probeResult)) {
    return { shouldIgnoreManualPaste: true, reason: 'non_editable_container_target' }
  }

  // AX probe can under-report editability (notably in complex/fullscreen UI trees).
  // Be optimistic here so user Cmd+V is replayed instead of being swallowed.
  return { shouldIgnoreManualPaste: false }
}
