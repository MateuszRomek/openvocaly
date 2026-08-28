export type ProcessInvocation = {
  command: string
  args: string[]
}

/**
 * Keeps local media/model work below interactive macOS work in the scheduler.
 * This is a secondary guardrail; runtime concurrency remains explicitly bounded
 * by each model host. Darwin background policy is inherited by child processes.
 */
export const getReducedPriorityInvocation = (command: string, args: string[]): ProcessInvocation =>
  process.platform === 'darwin'
    ? { command: '/usr/sbin/taskpolicy', args: ['-b', '-c', 'background', command, ...args] }
    : { command, args }
