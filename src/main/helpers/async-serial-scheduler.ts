/**
 * Runs async tasks one-by-one in submission order.
 * A rejected task does not block later tasks in the queue.
 */
export class AsyncSerialScheduler {
  private tail: Promise<void> = Promise.resolve()

  run<T>(task: () => Promise<T>): Promise<T> {
    const runTask = this.tail.then(task, task)

    this.tail = runTask.then(
      () => undefined,
      () => undefined
    )

    return runTask
  }
}
