import { describe, expect, it } from 'vitest'
import { getProcessInvocation } from './process'

describe('getProcessInvocation', () => {
  it('keeps interactive dictation at normal process priority', () => {
    expect(getProcessInvocation('/runtime', ['--model', 'fast'], 'interactive')).toEqual({
      command: '/runtime',
      args: ['--model', 'fast']
    })
  })

  it('uses a lower CPU priority only for background meeting work on macOS', () => {
    const invocation = getProcessInvocation('/runtime', ['--model', 'efficient'], 'background')

    if (process.platform === 'darwin') {
      expect(invocation).toEqual({
        command: '/usr/bin/nice',
        args: ['-n', '10', '/runtime', '--model', 'efficient']
      })
      return
    }

    expect(invocation).toEqual({ command: '/runtime', args: ['--model', 'efficient'] })
  })
})
