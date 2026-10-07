import { describe, expect, it } from 'vitest'
import { planQuietAudioSpans } from './chunking'

const SAMPLE_RATE = 16000
const OPTIONS = { targetMs: 60_000, searchMs: 10_000, quietWindowMs: 200 }

/** Loud pseudo-speech everywhere except the given silent [startMs, endMs) gaps. */
const buildAudio = (durationMs: number, silences: Array<[number, number]>): Buffer => {
  const totalSamples = (durationMs * SAMPLE_RATE) / 1000
  const buffer = Buffer.alloc(totalSamples * 2)
  for (let index = 0; index < totalSamples; index += 1) {
    const ms = (index / SAMPLE_RATE) * 1000
    const silent = silences.some(([start, end]) => ms >= start && ms < end)
    const value = silent
      ? 0
      : Math.round(8000 * Math.sin(index * 0.37) + 4000 * Math.sin(index * 0.051))
    buffer.writeInt16LE(value, index * 2)
  }
  return buffer
}

describe('planQuietAudioSpans', () => {
  it('cuts long audio inside the pause nearest each target', () => {
    const silences: Array<[number, number]> = [
      [57_000, 57_400],
      [118_000, 118_400],
      [175_000, 175_400]
    ]

    const spans = planQuietAudioSpans(buildAudio(200_000, silences), SAMPLE_RATE, OPTIONS)

    expect(spans).toHaveLength(4)
    expect(spans[0].startMs).toBe(0)
    expect(spans[3].endMs).toBe(200_000)
    spans.slice(0, 3).forEach((span, index) => {
      expect(span.endMs).toBeGreaterThanOrEqual(silences[index][0])
      expect(span.endMs).toBeLessThanOrEqual(silences[index][1])
      expect(spans[index + 1].startMs).toBe(span.endMs)
    })
  })

  it('keeps short audio as one span', () => {
    expect(planQuietAudioSpans(buildAudio(65_000, []), SAMPLE_RATE, OPTIONS)).toEqual([
      { startMs: 0, endMs: 65_000 }
    ])
  })
})
