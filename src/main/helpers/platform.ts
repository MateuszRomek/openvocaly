export type DesktopPlatform = 'darwin' | 'win32' | 'linux' | 'unsupported'

export const isMacOS = (): boolean => process.platform === 'darwin'

export const isLinux = (): boolean => process.platform === 'linux'

export const isWindows = (): boolean => process.platform === 'win32'

export const resolveDesktopPlatform = (): DesktopPlatform => {
  switch (process.platform) {
    case 'darwin':
      return 'darwin'
    case 'win32':
      return 'win32'
    case 'linux':
      return 'linux'
    default:
      return 'unsupported'
  }
}
