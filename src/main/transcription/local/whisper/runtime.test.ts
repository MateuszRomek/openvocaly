import { beforeEach, describe, expect, it, vi } from 'vitest'

const server = vi.hoisted(() => ({
  start: vi.fn(async () => undefined),
  stop: vi.fn(async () => undefined),
  transcribe: vi.fn(async (): Promise<string> => '')
}))
const audio = vi.hoisted(() => ({ durationMs: 10_000 }))

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/openvocaly-test' } }))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))
vi.mock('./server-client', () => ({
  WhisperServerClient: class {
    isAvailable = (): boolean => true
    start = server.start
    stop = server.stop
    transcribe = server.transcribe
  }
}))
vi.mock('./model-manager', () => ({
  whisperModelManager: {
    ensureSupportedModel: () => true,
    isModelDownloaded: () => true
  }
}))
vi.mock('../ffmpeg-utils', () => ({
  getFfmpegPath: () => '/usr/bin/ffmpeg',
  convertFileToWav: async () => undefined,
  estimatePcm16WavDurationMs: async () => audio.durationMs,
  readPcm16WavData: async () => ({
    sampleRate: 16000,
    channels: 1,
    sampleBytes: Buffer.alloc((audio.durationMs / 1000) * 16000 * 2)
  }),
  buildPcm16WavBuffer: (bytes: Buffer) => bytes,
  safeCleanupPaths: async () => undefined
}))

import { WhisperRuntime } from './runtime'

const MODEL_ID = 'large-v3-turbo-q5_0'

describe('WhisperRuntime.transcribeArtifact', () => {
  beforeEach(() => {
    server.start.mockClear()
    server.stop.mockClear()
    server.transcribe.mockReset()
    audio.durationMs = 10_000
  })

  it('accepts a silent window without retrying or restarting the server', async () => {
    server.transcribe.mockResolvedValue('')

    const result = await new WhisperRuntime().transcribeArtifact('/in.m4a', MODEL_ID)

    expect(result.text).toBe('')
    expect(result.diagnostics.failedChunkIndexes).toEqual([])
    expect(server.transcribe).toHaveBeenCalledTimes(1)
    expect(server.stop).not.toHaveBeenCalled()
  })

  it('does not run a tail rescue when the trailing windows are silent', async () => {
    audio.durationMs = 90_000
    server.transcribe
      .mockResolvedValueOnce('hello there')
      .mockResolvedValueOnce('general kenobi')
      .mockResolvedValue('')

    const result = await new WhisperRuntime().transcribeArtifact('/in.m4a', MODEL_ID)

    expect(result.text).toBe('hello there general kenobi')
    expect(result.diagnostics.resultType).toBe('success_full')
    expect(server.transcribe).toHaveBeenCalledTimes(result.diagnostics.chunkCount ?? 0)
    expect(server.stop).not.toHaveBeenCalled()
  })

  it('restarts the server and retries after a runtime error', async () => {
    server.transcribe
      .mockRejectedValueOnce(new Error('Local Whisper runtime request failed: socket hang up'))
      .mockResolvedValueOnce('recovered text')

    const result = await new WhisperRuntime().transcribeArtifact('/in.m4a', MODEL_ID)

    expect(result.text).toBe('recovered text')
    expect(server.stop).toHaveBeenCalledTimes(1)
    expect(server.transcribe).toHaveBeenCalledTimes(2)
  })

  it('marks a window as failed when every attempt errors', async () => {
    server.transcribe.mockRejectedValue(new Error('Local Whisper transcription timed out.'))

    const result = await new WhisperRuntime().transcribeArtifact('/in.m4a', MODEL_ID)

    expect(result.text).toBe('')
    expect(result.diagnostics.resultType).toBe('failed_timeout')
    expect(result.diagnostics.failedChunkIndexes).toEqual([1])
  })
})
