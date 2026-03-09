import type { DesktopPlatform } from '../../helpers/platform'

export const resolvePasteShortcutLabel = (platform: DesktopPlatform): string => {
  if (platform === 'darwin') {
    return 'Cmd+V'
  }

  return 'Ctrl+V'
}

export const getManualPasteHint = (platform: DesktopPlatform): string =>
  `Focus text field, press ${resolvePasteShortcutLabel(platform)} • Esc to cancel`

export const getUnsupportedPlatformMessage = (platform: DesktopPlatform): string =>
  `Auto-paste is not supported on ${platform} yet. Transcript was copied to clipboard.`
