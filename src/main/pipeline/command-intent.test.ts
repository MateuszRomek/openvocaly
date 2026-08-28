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
})
