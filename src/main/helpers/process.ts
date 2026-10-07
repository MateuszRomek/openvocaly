export type ProcessInvocation = {
  command: string
  args: string[]
}

export type ProcessPriority = 'interactive' | 'background'

/**
 * Dictation work keeps normal priority: macOS background QoS also throttles
 * I/O and confines work to efficiency cores, which made push-to-talk slow.
 * Background work only lowers its CPU nice value.
 */
export const getProcessInvocation = (
  command: string,
  args: string[],
  priority: ProcessPriority
): ProcessInvocation =>
  priority === 'background' && process.platform === 'darwin'
    ? { command: '/usr/bin/nice', args: ['-n', '10', command, ...args] }
    : { command, args }
