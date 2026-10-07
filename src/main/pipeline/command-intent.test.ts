import { describe, expect, it } from 'vitest'
import type { RecordingCommand } from '../recording/command-bus'
import { resolveDictationCommandIntent } from './command-intent'

const cancelCommand: RecordingCommand = {
  type: 'cancel',
  emittedAt: 1
}

describe('resolveDictationCommandIntent', () => {
  it('cancels active transcription when the cancel shortcut is pressed', () => {
    expect(
      resolveDictationCommandIntent({ phase: 'transcribing', mode: 'toggle' }, cancelCommand)
    ).toEqual({ type: 'cancel_transcription' })
  })

  it('keeps cancel scoped to the active dictation phase', () => {
    expect(resolveDictationCommandIntent({ phase: 'idle', mode: null }, cancelCommand)).toEqual({
      type: 'ignore'
    })
    expect(
      resolveDictationCommandIntent(
        { phase: 'awaiting_manual_paste', mode: 'toggle' },
        cancelCommand
      )
    ).toEqual({ type: 'cancel_manual_paste' })
    expect(
      resolveDictationCommandIntent({ phase: 'recording', mode: 'toggle' }, cancelCommand)
    ).toEqual({ type: 'cancel' })
  })

  it('lets a new press interrupt the complete or failed display', () => {
    const pushToTalkStart: RecordingCommand = { type: 'push_to_talk_start', emittedAt: 1 }
    const toggle: RecordingCommand = { type: 'toggle', emittedAt: 1 }

    expect(
      resolveDictationCommandIntent({ phase: 'failed', mode: 'push_to_talk' }, pushToTalkStart)
    ).toEqual({ type: 'start', mode: 'push_to_talk' })
    expect(
      resolveDictationCommandIntent({ phase: 'complete', mode: 'push_to_talk' }, toggle)
    ).toEqual({ type: 'start', mode: 'toggle' })
    expect(
      resolveDictationCommandIntent(
        { phase: 'transcribing', mode: 'push_to_talk' },
        pushToTalkStart
      )
    ).toEqual({ type: 'ignore' })
  })
})
