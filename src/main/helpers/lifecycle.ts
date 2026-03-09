import { createUnrefDelay } from './timers'

export type LifecycleContract = {
  initialize?: () => Promise<void> | void
  shutdown?: () => Promise<void> | void
}

export const withShutdownTimeout = async (
  operation: () => Promise<void>,
  timeoutMs: number
): Promise<void> => {
  await Promise.race([operation(), createUnrefDelay(timeoutMs)])
}
