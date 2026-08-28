import { describe, expect, it } from 'vitest'
import {
  createDefaultPreferences,
  mergePreferences,
  resolveLoadedPreferences
} from './preferences-manager-helpers'

describe('recording preferences helpers', () => {
  it('defaults sound cue volume to 100 percent', () => {
    expect(createDefaultPreferences().soundCues).toEqual({
      enabled: true,
      volume: 1
    })
  })

  it('clamps sound cue volume updates to the supported range', () => {
    const preferences = createDefaultPreferences()

    expect(mergePreferences(preferences, { soundCues: { volume: 2 } }).soundCues.volume).toBe(1)
    expect(mergePreferences(preferences, { soundCues: { volume: -1 } }).soundCues.volume).toBe(0)
    expect(
      mergePreferences(preferences, { soundCues: { volume: Number.NaN } }).soundCues.volume
    ).toBe(1)
  })

  it('keeps existing users at full volume when loading legacy settings', () => {
    const loaded = resolveLoadedPreferences({
      soundCues: { enabled: false }
    })

    expect(loaded.soundCues).toEqual({
      enabled: false,
      volume: 1
    })
  })
})
