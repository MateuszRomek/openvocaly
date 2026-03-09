import type { DictationOverlayState } from '../../shared/dictation'

const IDLE_BAR_BASE = 0.06
const IDLE_BAR_PULSE = 0.01

export const IDLE_SCALE_FLOOR = 0.14
const ACTIVE_SCALE_GAIN = 0.74
const MAX_SCALE = 0.78

export const IDLE_OPACITY_BASE = 0.32
const ACTIVE_OPACITY_GAIN = 0.68
const MAX_OPACITY = 1

export const BAR_COUNT = 20
const CENTER_INDEX = (BAR_COUNT - 1) / 2
const PROCESSING_SWEEP_SECONDS = 1.18
const PROCESSING_HEAD_PADDING_BARS = 3.5
const PROCESSING_WAVE_SPREAD_BARS = 2.2
const PROCESSING_BASE = 0.09
const PROCESSING_PRIMARY_GAIN = 0.5
const PROCESSING_TRAIL_GAIN = 0.18
const PROCESSING_RIPPLE_GAIN = 0.08

const getCenterWeight = (index: number): number => {
  const distance = Math.abs(index - CENTER_INDEX) / CENTER_INDEX
  return 1 - distance * 0.45
}

export const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }

  if (value <= 0) {
    return 0
  }

  if (value >= 1) {
    return 1
  }

  return value
}

export const createBars = (value: number): number[] =>
  Array.from({ length: BAR_COUNT }, () => value)

export const createBarIndexes = (): number[] =>
  Array.from({ length: BAR_COUNT }, (_, index) => index)

const toGaussian = (distance: number, spread: number): number =>
  Math.exp(-(distance * distance) / (2 * spread * spread))

const getProcessingWave = (index: number, now: number): number => {
  // Sweep a highlighted wave head from left to right during transcription.
  const cycleProgress = (now % PROCESSING_SWEEP_SECONDS) / PROCESSING_SWEEP_SECONDS
  const travelDistance = BAR_COUNT - 1 + PROCESSING_HEAD_PADDING_BARS * 2
  const headPosition = -PROCESSING_HEAD_PADDING_BARS + cycleProgress * travelDistance
  const distanceFromHead = index - headPosition

  const primary = toGaussian(distanceFromHead, PROCESSING_WAVE_SPREAD_BARS)
  const trailing = toGaussian(distanceFromHead + 2.6, PROCESSING_WAVE_SPREAD_BARS * 1.85)
  const ripple = (Math.sin(distanceFromHead * 1.35 - now * 8.2) + 1) / 2

  return clamp01(
    PROCESSING_BASE +
      primary * PROCESSING_PRIMARY_GAIN +
      trailing * PROCESSING_TRAIL_GAIN +
      ripple * PROCESSING_RIPPLE_GAIN * (0.5 + primary * 0.5)
  )
}

export const toTargetBars = (state: DictationOverlayState): number[] => {
  const level = clamp01(state.meterLevel)

  if (!state.bands.length) {
    return createBars(level * 0.35)
  }

  return Array.from({ length: BAR_COUNT }, (_, index) => {
    const band = clamp01(state.bands[index] ?? level * 0.35)
    return band * (0.68 + getCenterWeight(index) * 0.32)
  })
}

export const resolveBarTarget = (
  phase: DictationOverlayState['phase'],
  index: number,
  now: number,
  target: number
): number => {
  if (phase === 'transcribing') {
    return getProcessingWave(index, now)
  }

  if (phase !== 'recording') {
    const idlePulse = Math.sin(now * 2 + index * 0.31) * IDLE_BAR_PULSE
    return IDLE_BAR_BASE + idlePulse
  }

  return target
}

export const getBarSmoothing = (phase: DictationOverlayState['phase']): number =>
  phase === 'recording' ? 0.24 : phase === 'transcribing' ? 0.2 : 0.16

export const toBarVisuals = (current: number): { scale: number; opacity: number } => ({
  scale: Math.min(MAX_SCALE, IDLE_SCALE_FLOOR + current * ACTIVE_SCALE_GAIN),
  opacity: Math.min(MAX_OPACITY, IDLE_OPACITY_BASE + current * ACTIVE_OPACITY_GAIN)
})
