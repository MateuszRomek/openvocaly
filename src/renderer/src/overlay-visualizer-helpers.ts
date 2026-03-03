import type { DictationOverlayState } from '../../shared/dictation'

const IDLE_BAR_BASE = 0.06
const IDLE_BAR_PULSE = 0.01

export const IDLE_SCALE_FLOOR = 0.14
const ACTIVE_SCALE_GAIN = 0.74
const MAX_SCALE = 0.78

export const IDLE_OPACITY_BASE = 0.24
const ACTIVE_OPACITY_GAIN = 0.66
const MAX_OPACITY = 0.95

export const BAR_COUNT = 20
const CENTER_INDEX = (BAR_COUNT - 1) / 2

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

const getProcessingWave = (index: number, now: number): number => {
  const phase = now * 3.2 + index * 0.23
  const wave = (Math.sin(phase) + 1) / 2
  return 0.16 + wave * 0.34
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
  phase === 'recording' ? 0.24 : 0.16

export const toBarVisuals = (current: number): { scale: number; opacity: number } => ({
  scale: Math.min(MAX_SCALE, IDLE_SCALE_FLOOR + current * ACTIVE_SCALE_GAIN),
  opacity: Math.min(MAX_OPACITY, IDLE_OPACITY_BASE + current * ACTIVE_OPACITY_GAIN)
})
