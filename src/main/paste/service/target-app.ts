import type { SessionTargetApp } from '../../../shared/storage'
import type { PasteProbeResult } from '../platform-adapter'

export const toSessionTargetApp = (
  probeResult: PasteProbeResult | null
): SessionTargetApp | null => {
  if (!probeResult) {
    return null
  }

  const normalizedName = probeResult.frontProcessName?.trim() ?? ''
  const normalizedIdentifier = probeResult.frontProcessIdentifier?.trim() ?? ''
  const normalizedPath = probeResult.frontProcessPath?.trim() ?? ''

  if (!normalizedName && !normalizedIdentifier && !normalizedPath) {
    return null
  }

  return {
    name: normalizedName || null,
    identifier: normalizedIdentifier || null,
    appPath: normalizedPath || null
  }
}
