import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { planQuietAudioSpans, type AudioSpan } from '../transcription/local/chunking'
import {
  buildPcm16WavBuffer,
  convertFileToWav,
  readPcm16WavData
} from '../transcription/local/ffmpeg-utils'

export type MeetingAudioChunk = AudioSpan & { filePath: string }

const SAMPLE_RATE = 16000
const CHUNK_TARGET_MS = 60_000
const CHUNK_SEARCH_MS = 10_000
const CHUNK_QUIET_WINDOW_MS = 200

export const prepareMeetingAudioChunks = async (
  sourceFilePath: string,
  workDir: string,
  signal: AbortSignal
): Promise<MeetingAudioChunk[]> => {
  const fullWavPath = join(workDir, 'meeting.wav')
  await convertFileToWav(sourceFilePath, fullWavPath, {
    sampleRate: SAMPLE_RATE,
    channels: 1,
    signal,
    priority: 'background'
  })
  const audio = await readPcm16WavData(fullWavPath)
  const spans = planQuietAudioSpans(audio.sampleBytes, audio.sampleRate, {
    targetMs: CHUNK_TARGET_MS,
    searchMs: CHUNK_SEARCH_MS,
    quietWindowMs: CHUNK_QUIET_WINDOW_MS
  })
  const bytesPerMs = (audio.sampleRate * 2) / 1000

  const chunks: MeetingAudioChunk[] = []
  for (const [index, span] of spans.entries()) {
    const filePath = join(workDir, `chunk-${String(index + 1).padStart(4, '0')}.wav`)
    const startByte = Math.floor(span.startMs * bytesPerMs) & ~1
    const endByte =
      index === spans.length - 1
        ? audio.sampleBytes.length
        : Math.floor(span.endMs * bytesPerMs) & ~1
    await writeFile(
      filePath,
      buildPcm16WavBuffer(audio.sampleBytes.subarray(startByte, endByte), {
        sampleRate: audio.sampleRate,
        channels: 1
      })
    )
    chunks.push({ ...span, filePath })
  }
  await rm(fullWavPath, { force: true })
  return chunks
}
