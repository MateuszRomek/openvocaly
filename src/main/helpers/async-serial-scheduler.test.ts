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

  it('runs queued interactive work before queued background work', async () => {
    const scheduler = new AsyncSerialScheduler()
    const order: string[] = []
    let releaseRunningTask: (() => void) | undefined
    const runningTaskGate = new Promise<void>((resolve) => {
      releaseRunningTask = resolve
    })
    const record = (name: string) => async (): Promise<void> => {
      order.push(name)
    }

    const running = scheduler.run(async () => {
      await runningTaskGate
      order.push('meeting chunk 1')
    }, 'background')
    const queued = [
      scheduler.run(record('meeting chunk 2'), 'background'),
      scheduler.run(record('dictation 1')),
      scheduler.run(record('meeting chunk 3'), 'background'),
      scheduler.run(record('dictation 2'), 'interactive')
    ]
    releaseRunningTask?.()
    await Promise.all([running, ...queued])

    expect(order).toEqual([
      'meeting chunk 1',
      'dictation 1',
      'dictation 2',
      'meeting chunk 2',
      'meeting chunk 3'
    ])
  })

  it('keeps running later tasks after a task rejects', async () => {
    const scheduler = new AsyncSerialScheduler()

    const failing = scheduler.run(async () => {
      throw new Error('boom')
    })
    const next = scheduler.run(async () => 'next', 'background')

    await expect(failing).rejects.toThrow('boom')
    await expect(next).resolves.toBe('next')
    expect(scheduler.isBusy()).toBe(false)
  })
})
