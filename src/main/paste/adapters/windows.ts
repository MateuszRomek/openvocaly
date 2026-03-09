import { NoopPastePlatformAdapter } from './noop'

export class WindowsPastePlatformAdapter extends NoopPastePlatformAdapter {
  constructor() {
    super('win32')
  }
}
