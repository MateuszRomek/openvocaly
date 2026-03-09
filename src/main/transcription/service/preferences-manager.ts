import type {
  TranscriptionPreferences,
  TranscriptionPreferencesUpdateInput
} from '../../../shared/transcription'
import { JsonSettingsManager } from '../../repositories/json-settings-manager'
import { SettingsRepository } from '../../repositories/settings-repository'
import {
  createDefaultPreferences,
  mergePreferences,
  resolveLoadedPreferences
} from './preferences-manager-helpers'

const TRANSCRIPTION_PREFERENCES_SETTING_KEY = 'transcription.preferences'

/**
 * Runtime manager for transcription preferences with JSON persistence.
 */
export class TranscriptionPreferencesManager {
  private readonly settingsManager: JsonSettingsManager<
    TranscriptionPreferences,
    TranscriptionPreferencesUpdateInput
  >

  constructor(settingsRepository: SettingsRepository = new SettingsRepository()) {
    this.settingsManager = new JsonSettingsManager({
      settingsRepository,
      settingKey: TRANSCRIPTION_PREFERENCES_SETTING_KEY,
      createDefaultState: createDefaultPreferences,
      mergeState: mergePreferences,
      resolveLoadedState: resolveLoadedPreferences,
      cloneState: (state) => ({
        providerId: state.providerId,
        modelId: state.modelId
      }),
      onParseError: (error) => {
        console.error('[transcription] failed to parse DB preferences, using defaults', error)
      }
    })
  }

  initialize(): Promise<void> {
    return this.settingsManager.initialize()
  }

  get(): TranscriptionPreferences {
    return this.settingsManager.get()
  }

  update(params: TranscriptionPreferencesUpdateInput): Promise<TranscriptionPreferences> {
    return this.settingsManager.update(params)
  }
}
