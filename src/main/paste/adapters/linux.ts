import { NoopPastePlatformAdapter } from './noop'

export class LinuxPastePlatformAdapter extends NoopPastePlatformAdapter {
  constructor() {
    super('linux')
  }
}
