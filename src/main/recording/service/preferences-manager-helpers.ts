import type {
  RecordingMicrophoneSettings,
  RecordingPreferences,
  RecordingPreferencesUpdateInput,
  RecordingSoundCueSettings
} from '../../../shared/recording'
import {
  DEFAULT_RECORDING_MICROPHONE_SETTINGS,
  DEFAULT_RECORDING_SOUND_CUE_SETTINGS
} from '../../../shared/recording'

export const createDefaultPreferences = (): RecordingPreferences => ({
  soundCues: {
    enabled: DEFAULT_RECORDING_SOUND_CUE_SETTINGS.enabled
  },
  microphone: {
    selectedDeviceId: DEFAULT_RECORDING_MICROPHONE_SETTINGS.selectedDeviceId
  }
})

const normalizeSoundCueSettings = (
  params: Partial<RecordingSoundCueSettings> | undefined,
  fallback: RecordingSoundCueSettings
): RecordingSoundCueSettings => ({
  enabled: typeof params?.enabled === 'boolean' ? params.enabled : fallback.enabled
})

const normalizeMicrophoneSettings = (
  params: Partial<RecordingMicrophoneSettings> | undefined,
  fallback: RecordingMicrophoneSettings
): RecordingMicrophoneSettings => ({
  selectedDeviceId:
    typeof params?.selectedDeviceId === 'string' || params?.selectedDeviceId === null
      ? params.selectedDeviceId
      : fallback.selectedDeviceId
})

export const mergePreferences = (
  base: RecordingPreferences,
  patch?: RecordingPreferencesUpdateInput
): RecordingPreferences => ({
  soundCues: normalizeSoundCueSettings(patch?.soundCues, base.soundCues),
  microphone: normalizeMicrophoneSettings(patch?.microphone, base.microphone)
})

export const resolveLoadedPreferences = (
  parsed: Partial<RecordingPreferences>
): RecordingPreferences => ({
  soundCues: normalizeSoundCueSettings(parsed.soundCues, createDefaultPreferences().soundCues),
  microphone: normalizeMicrophoneSettings(parsed.microphone, createDefaultPreferences().microphone)
})
