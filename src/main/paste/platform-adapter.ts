import type { DesktopPlatform } from '../helpers/platform'

export type PastePlatformCapabilities = {
  platform: DesktopPlatform
  implementationState: 'ready' | 'not_implemented'
  supportsAutoPaste: boolean
  supportsEditableProbe: boolean
  supportsManualPasteWatcher: boolean
  requiresAccessibilityPermission: boolean
}

export type PasteProbeResult = {
  ok: boolean
  isEditable: boolean
  isSelfApp?: boolean
  frontProcessName?: string
  frontProcessIdentifier?: string
  frontProcessPath?: string
  frontProcessPid?: number
  focusedRole?: string
  focusedSubrole?: string
  message?: string
}

export type AutoPasteProbeDecision = {
  shouldAttemptAutoPaste: boolean
  reason?: string
}

export type ManualPasteProbeDecision = {
  shouldIgnoreManualPaste: boolean
  reason?: string
}

export type PasteActionResult = {
  ok: boolean
  message?: string
}

export type ManualPasteWatcherStartResult = {
  ok: boolean
  message?: string
}

export interface PastePlatformAdapter {
  capabilities(): PastePlatformCapabilities
  probeEditableTarget(): Promise<PasteProbeResult>
  evaluateAutoPasteProbe?(probeResult: PasteProbeResult): AutoPasteProbeDecision
  evaluateManualPasteProbe?(probeResult: PasteProbeResult): ManualPasteProbeDecision
  simulatePasteShortcut(): Promise<PasteActionResult>
  startManualPasteWatcher(onPasteShortcut: () => void): Promise<ManualPasteWatcherStartResult>
  stopManualPasteWatcher(): void
}
