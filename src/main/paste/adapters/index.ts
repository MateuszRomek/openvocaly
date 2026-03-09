import type { DesktopPlatform } from '../../helpers/platform'
import type { PastePlatformAdapter } from '../platform-adapter'
import { LinuxPastePlatformAdapter } from './linux'
import { MacOSPastePlatformAdapter } from './macos/adapter'
import { NoopPastePlatformAdapter } from './noop'
import { WindowsPastePlatformAdapter } from './windows'

const assertUnreachable = (value: never): never => {
  throw new Error(`Unsupported desktop platform: ${value}`)
}

export const getPastePlatformAdapter = (platform: DesktopPlatform): PastePlatformAdapter => {
  switch (platform) {
    case 'darwin':
      return new MacOSPastePlatformAdapter()
    case 'win32':
      return new WindowsPastePlatformAdapter()
    case 'linux':
      return new LinuxPastePlatformAdapter()
    case 'unsupported':
      return new NoopPastePlatformAdapter('unsupported')
    default:
      return assertUnreachable(platform)
  }
}
