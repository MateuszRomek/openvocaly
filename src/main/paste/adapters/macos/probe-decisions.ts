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
const BROWSER_PROCESS_MARKERS = ['brave', 'chrome', 'firefox', 'safari', 'edge', 'arc'] as const

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
  'axrow',
  'axtabgroup',
  'axoutline'
])

const isBrowserProcess = (processName?: string): boolean => {
  const normalized = processName?.toLowerCase()
  if (!normalized) {
    return false
  }

  return BROWSER_PROCESS_MARKERS.some((marker) => normalized.includes(marker))
}

const isLikelyDesktopTarget = (probeResult: PasteProbeResult): boolean => {
  const processName = probeResult.frontProcessName?.toLowerCase()
  if (processName !== 'finder') {
    return false
  }

  const role = probeResult.focusedRole?.toLowerCase()
  return !role || role === 'axapplication' || role === 'axwindow'
}

const isLikelyBrowserNonEditableSurface = (probeResult: PasteProbeResult): boolean => {
  const processName = probeResult.frontProcessName?.toLowerCase()
  if (!processName || !isBrowserProcess(processName)) {
    return false
  }

  const role = probeResult.focusedRole?.toLowerCase() ?? ''
  const subrole = probeResult.focusedSubrole?.toLowerCase() ?? ''

  return role === 'axwebarea' || subrole === 'axapplicationalert' || subrole === 'axunknown'
}

const isLikelyExplicitNonEditableContainer = (probeResult: PasteProbeResult): boolean => {
  if (probeResult.isEditable) {
    return false
  }

  const role = probeResult.focusedRole?.toLowerCase()
  if (!role) {
    return false
  }

  return NON_EDITABLE_CONTAINER_ROLES.has(role)
}

const isBrowserEditableTarget = (probeResult: PasteProbeResult): boolean => {
  if (!probeResult.isEditable) {
    return false
  }

  const role = probeResult.focusedRole?.toLowerCase()
  const subrole = probeResult.focusedSubrole?.toLowerCase()

  if (
    role === 'axtextfield' ||
    role === 'axtextarea' ||
    role === 'axsearchfield' ||
    role === 'axcombobox'
  ) {
    return true
  }

  return subrole === 'axsearchfield' || subrole === 'axtextfield'
}

/**
 * Decides if auto-paste is safe to attempt for the current macOS focus target.
 * If not safe, returns a reason used for logs/debugging.
 */
export const evaluateMacOSAutoPasteDecision = (
  probeResult: PasteProbeResult
): AutoPasteProbeDecision => {
  if (!probeResult.ok) {
    return { shouldAttemptAutoPaste: true }
  }

  let reason: string | undefined
  if (!probeResult.isEditable) {
    if (probeResult.isSelfApp) {
      reason = 'self_app_target'
    } else if (isLikelyDesktopTarget(probeResult)) {
      reason = 'desktop_like_target'
    } else if (isLikelyBrowserNonEditableSurface(probeResult)) {
      reason = 'browser_non_editable_surface'
    } else if (isLikelyExplicitNonEditableContainer(probeResult)) {
      reason = 'non_editable_container_target'
    }
  }

  if (isBrowserProcess(probeResult.frontProcessName) && !isBrowserEditableTarget(probeResult)) {
    reason = reason ?? 'browser_unconfirmed_editable_target'
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
  if (!probeResult.ok || probeResult.isEditable) {
    return { shouldIgnoreManualPaste: false }
  }

  if (isLikelyDesktopTarget(probeResult)) {
    return { shouldIgnoreManualPaste: true, reason: 'desktop_target' }
  }

  if (isLikelyBrowserNonEditableSurface(probeResult)) {
    return { shouldIgnoreManualPaste: true, reason: 'browser_non_editable_surface' }
  }

  if (isLikelyExplicitNonEditableContainer(probeResult)) {
    return { shouldIgnoreManualPaste: true, reason: 'non_editable_container_target' }
  }

  return { shouldIgnoreManualPaste: false }
}
