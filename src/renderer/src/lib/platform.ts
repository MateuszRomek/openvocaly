export type DesktopPlatform = Window['api']['system']['platform']

export const getDesktopPlatform = (): DesktopPlatform => window.api.system.platform

export const isMacOS = (): boolean => getDesktopPlatform() === 'darwin'
