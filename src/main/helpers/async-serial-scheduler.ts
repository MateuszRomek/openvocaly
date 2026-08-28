/**
 * Runs async tasks one-by-one in submission order.
 * A rejected task does not block later tasks in the queue.
 */
export class AsyncSerialScheduler {
  private tail: Promise<void> = Promise.resolve()
  private pendingTaskCount = 0

  /** Reports whether a submitted task is running or waiting for this scheduler. */
  isBusy(): boolean {
    return this.pendingTaskCount > 0
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    this.pendingTaskCount += 1
    const runTask = this.tail.then(task, task).finally(() => {
      this.pendingTaskCount -= 1
    })

    this.tail = runTask.then(
      () => undefined,
      () => undefined
    )

    return runTask
  }
}
