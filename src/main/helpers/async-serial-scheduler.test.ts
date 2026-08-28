import { describe, expect, it } from 'vitest'
import { AsyncSerialScheduler } from './async-serial-scheduler'

describe('AsyncSerialScheduler', () => {
  it('remains busy while work is queued or running', async () => {
    const scheduler = new AsyncSerialScheduler()
    let releaseFirstTask: (() => void) | undefined
    const firstTaskGate = new Promise<void>((resolve) => {
      releaseFirstTask = resolve
    })

    const firstTask = scheduler.run(async () => {
      await firstTaskGate
      return 'first'
    })
    const secondTask = scheduler.run(async () => 'second')

    expect(scheduler.isBusy()).toBe(true)
    releaseFirstTask?.()

    await expect(Promise.all([firstTask, secondTask])).resolves.toEqual(['first', 'second'])
    expect(scheduler.isBusy()).toBe(false)
  })
})
