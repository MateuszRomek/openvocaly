import type {
  RecordingPreferences,
  RecordingPreferencesUpdateInput,
  RecordingSoundCueSettings
} from '../../../shared/recording'
import { DEFAULT_RECORDING_SOUND_CUE_SETTINGS } from '../../../shared/recording'

export const createDefaultPreferences = (): RecordingPreferences => ({
  soundCues: {
    enabled: DEFAULT_RECORDING_SOUND_CUE_SETTINGS.enabled
  }
})

const normalizeSoundCueSettings = (
  input: Partial<RecordingSoundCueSettings> | undefined,
  fallback: RecordingSoundCueSettings
): RecordingSoundCueSettings => ({
  enabled: typeof input?.enabled === 'boolean' ? input.enabled : fallback.enabled
})

export const mergePreferences = (
  base: RecordingPreferences,
  patch?: RecordingPreferencesUpdateInput
): RecordingPreferences => ({
  soundCues: normalizeSoundCueSettings(patch?.soundCues, base.soundCues)
})

export const resolveLoadedPreferences = (
  parsed: Partial<RecordingPreferences>
): RecordingPreferences => ({
  soundCues: normalizeSoundCueSettings(parsed.soundCues, createDefaultPreferences().soundCues)
})
