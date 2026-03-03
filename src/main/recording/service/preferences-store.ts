import { eq } from 'drizzle-orm'
import { getDb, initDb } from '../../db'
import type {
  RecordingPreferences,
  RecordingPreferencesUpdateInput
} from '../../../shared/recording'
import { appSettings } from '../../../shared/schema'
import {
  createDefaultPreferences,
  mergePreferences,
  resolveLoadedPreferences
} from './preferences-store-helpers'

const RECORDING_PREFERENCES_SETTING_KEY = 'recording.preferences'

/**
 * Persists recording preferences in SQLite.
 */
export class RecordingPreferencesStore {
  private initialized = false
  private preferences: RecordingPreferences = createDefaultPreferences()

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    initDb()
    this.loadFromDb()
    this.initialized = true
  }

  get(): RecordingPreferences {
    return {
      soundCues: { ...this.preferences.soundCues },
      microphone: { ...this.preferences.microphone }
    }
  }

  async update(input: RecordingPreferencesUpdateInput): Promise<RecordingPreferences> {
    await this.initialize()
    this.preferences = mergePreferences(this.preferences, input)
    this.persistToDb()
    return this.get()
  }

  private loadFromDb(): void {
    const db = getDb()
    const row = db
      .select({ valueJson: appSettings.valueJson })
      .from(appSettings)
      .where(eq(appSettings.key, RECORDING_PREFERENCES_SETTING_KEY))
      .get()

    if (!row) {
      this.preferences = createDefaultPreferences()
      this.persistToDb()
      return
    }

    try {
      const parsed = JSON.parse(row.valueJson) as Partial<RecordingPreferences>
      this.preferences = resolveLoadedPreferences(parsed)
    } catch (error) {
      console.error('[recording] failed to parse DB preferences, using defaults', error)
      this.preferences = createDefaultPreferences()
      this.persistToDb()
    }
  }

  private persistToDb(): void {
    const db = getDb()
    const valueJson = JSON.stringify(this.preferences)
    const updatedAt = Date.now()

    db.insert(appSettings)
      .values({
        key: RECORDING_PREFERENCES_SETTING_KEY,
        valueJson,
        updatedAt
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          valueJson,
          updatedAt
        }
      })
      .run()
  }
}
