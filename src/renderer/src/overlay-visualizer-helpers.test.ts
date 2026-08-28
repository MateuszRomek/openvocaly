import { describe, expect, it } from 'vitest'
import { getBarSmoothing, resolveBarTarget } from './overlay-visualizer-helpers'

describe('overlay visualizer helpers', () => {
  it('attacks faster than it releases during recording', () => {
    const attack = getBarSmoothing('recording', 0.1, 0.8)
    const release = getBarSmoothing('recording', 0.8, 0.1)

    expect(attack).toBeGreaterThan(release)
  })

  it('keeps the processing wave moving when motion is enabled', () => {
    const initial = resolveBarTarget('transcribing', 8, 0, 0)
    const later = resolveBarTarget('transcribing', 8, 0.6, 0)

    expect(later).not.toBe(initial)
  })

  it('uses a stable processing shape when reduced motion is enabled', () => {
    const initial = resolveBarTarget('transcribing', 8, 0, 0, true)
    const later = resolveBarTarget('transcribing', 8, 0.6, 0, true)

    expect(later).toBe(initial)
  })
})
