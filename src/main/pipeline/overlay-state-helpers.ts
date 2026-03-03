import type { DictationOverlayState } from '../../shared/dictation'

const LEVEL_EPSILON = 0.01
const BAND_EPSILON = 0.02

export const cloneOverlayState = (state: DictationOverlayState): DictationOverlayState => ({
  ...state,
  bands: [...state.bands]
})

export const isSameOverlayState = (
  left: DictationOverlayState | null,
  right: DictationOverlayState | null
): boolean => {
  if (left === right) {
    return true
  }

  if (!left || !right) {
    return false
  }

  if (left.phase !== right.phase || left.mode !== right.mode || left.message !== right.message) {
    return false
  }

  if (Math.abs(left.meterLevel - right.meterLevel) > LEVEL_EPSILON) {
    return false
  }

  if (left.bands.length !== right.bands.length) {
    return false
  }

  for (let index = 0; index < left.bands.length; index += 1) {
    if (Math.abs((left.bands[index] ?? 0) - (right.bands[index] ?? 0)) > BAND_EPSILON) {
      return false
    }
  }

  return true
}
