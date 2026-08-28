import type {
  RecordingMicrophoneSettings,
  RecordingPreferences,
  RecordingPreferencesUpdateInput,
  RecordingSoundCueSettings
} from '../../../shared/recording'
import {
  DEFAULT_RECORDING_MICROPHONE_SETTINGS,
  DEFAULT_RECORDING_SOUND_CUE_SETTINGS,
  normalizeRecordingSoundCueVolume
} from '../../../shared/recording'

type PartialRecordingPreferences = {
  soundCues?: Partial<RecordingSoundCueSettings>
  microphone?: Partial<RecordingMicrophoneSettings>
}

export const createDefaultPreferences = (): RecordingPreferences => ({
  soundCues: {
    enabled: DEFAULT_RECORDING_SOUND_CUE_SETTINGS.enabled,
    volume: DEFAULT_RECORDING_SOUND_CUE_SETTINGS.volume
  },
  microphone: {
    selectedDeviceId: DEFAULT_RECORDING_MICROPHONE_SETTINGS.selectedDeviceId
  }
})

const normalizeSoundCueSettings = (
  params: Partial<RecordingSoundCueSettings> | undefined,
  fallback: RecordingSoundCueSettings
): RecordingSoundCueSettings => ({
  enabled: typeof params?.enabled === 'boolean' ? params.enabled : fallback.enabled,
  volume: normalizeRecordingSoundCueVolume(params?.volume, fallback.volume)
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
  parsed: PartialRecordingPreferences
): RecordingPreferences => ({
  soundCues: normalizeSoundCueSettings(parsed.soundCues, createDefaultPreferences().soundCues),
  microphone: normalizeMicrophoneSettings(parsed.microphone, createDefaultPreferences().microphone)
})
