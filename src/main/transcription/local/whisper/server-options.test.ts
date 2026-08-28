import { describe, expect, it } from 'vitest'
import { buildWhisperServerArgs } from './server-options'

describe('buildWhisperServerArgs', () => {
  it('uses the conservative Metal policy for sustained local transcription', () => {
    expect(
      buildWhisperServerArgs({
        modelPath: '/models/whisper-turbo-q5.bin',
        port: 6030
      })
    ).toEqual([
      '--model',
      '/models/whisper-turbo-q5.bin',
      '--host',
      '127.0.0.1',
      '--port',
      '6030',
      '--language',
      'auto',
      '--threads',
      '1'
    ])
  })

  it('keeps CPU-only execution available for controlled diagnostics', () => {
    expect(
      buildWhisperServerArgs({
        modelPath: '/models/whisper-turbo-q5.bin',
        port: 6030,
        threads: 2,
        gpuEnabled: false
      })
    ).toContain('--no-gpu')
  })
})
