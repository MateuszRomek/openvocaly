export type SchedulerPriority = 'interactive' | 'background'

/**
 * Runs async tasks one at a time. Queued interactive tasks run before queued
 * background tasks; within one priority, tasks run in submission order.
 * A running task is never preempted, so background work must be submitted as
 * bounded jobs. A rejected task does not block later tasks.
 */
export class AsyncSerialScheduler {
  private readonly queues: Record<SchedulerPriority, Array<() => Promise<void>>> = {
    interactive: [],
    background: []
  }
  private running = false

  /** Reports whether a submitted task is running or waiting for this scheduler. */
  isBusy(): boolean {
    return this.running || this.queues.interactive.length > 0 || this.queues.background.length > 0
  }

  run<T>(task: () => Promise<T>, priority: SchedulerPriority = 'interactive'): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queues[priority].push(() => Promise.resolve().then(task).then(resolve, reject))
      this.drain()
    })
  }

  private drain(): void {
    if (this.running) {
      return
    }
    const next = this.queues.interactive.shift() ?? this.queues.background.shift()
    if (!next) {
      return
    }
    this.running = true
    void next().finally(() => {
      this.running = false
      this.drain()
    })
  }
}
