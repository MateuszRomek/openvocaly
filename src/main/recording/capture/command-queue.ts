import type { RecordingCaptureCommand } from '../../../shared/recording'

export type CaptureCommandDispatchResult = 'sent' | 'halt'

export type CaptureCommandDrainResult = {
  remaining: RecordingCaptureCommand[]
  deliveredCount: number
}

/**
 * Drains queued commands in-order.
 *
 * If dispatcher reports `halt`, the current command and all following commands
 * stay queued so the caller can replay the full unsent suffix later.
 */
export const drainCaptureCommandQueue = (
  queue: readonly RecordingCaptureCommand[],
  dispatch: (command: RecordingCaptureCommand) => CaptureCommandDispatchResult
): CaptureCommandDrainResult => {
  for (let index = 0; index < queue.length; index += 1) {
    const command = queue[index]
    if (dispatch(command) === 'halt') {
      return {
        remaining: queue.slice(index),
        deliveredCount: index
      }
    }
  }

  return {
    remaining: [],
    deliveredCount: queue.length
  }
}
