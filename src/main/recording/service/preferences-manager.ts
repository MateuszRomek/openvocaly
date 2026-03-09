import type {
  RecordingPreferences,
  RecordingPreferencesUpdateInput
} from '../../../shared/recording'
import { JsonSettingsManager } from '../../repositories/json-settings-manager'
import { SettingsRepository } from '../../repositories/settings-repository'
import {
  createDefaultPreferences,
  mergePreferences,
  resolveLoadedPreferences
} from './preferences-manager-helpers'

const RECORDING_PREFERENCES_SETTING_KEY = 'recording.preferences'

/**
 * Runtime manager for recording preferences with JSON persistence.
 */
export class RecordingPreferencesManager {
  private readonly settingsManager: JsonSettingsManager<
    RecordingPreferences,
    RecordingPreferencesUpdateInput
  >

  constructor(settingsRepository: SettingsRepository = new SettingsRepository()) {
    this.settingsManager = new JsonSettingsManager({
      settingsRepository,
      settingKey: RECORDING_PREFERENCES_SETTING_KEY,
      createDefaultState: createDefaultPreferences,
      mergeState: mergePreferences,
      resolveLoadedState: resolveLoadedPreferences,
      cloneState: (state) => ({
        soundCues: { ...state.soundCues },
        microphone: { ...state.microphone }
      }),
      onParseError: (error) => {
        console.error('[recording] failed to parse DB preferences, using defaults', error)
      }
    })
  }

  initialize(): Promise<void> {
    return this.settingsManager.initialize()
  }

  get(): RecordingPreferences {
    return this.settingsManager.get()
  }

  update(params: RecordingPreferencesUpdateInput): Promise<RecordingPreferences> {
    return this.settingsManager.update(params)
  }
}
