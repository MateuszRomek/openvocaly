import { eq } from 'drizzle-orm'
import { getDb, initDb } from '../../db'
import type {
  TranscriptionPreferences,
  TranscriptionPreferencesUpdateInput
} from '../../../shared/transcription'
import { appSettings } from '../../../shared/schema'
import {
  createDefaultPreferences,
  mergePreferences,
  resolveLoadedPreferences
} from './preferences-store-helpers'

const TRANSCRIPTION_PREFERENCES_SETTING_KEY = 'transcription.preferences'

export class TranscriptionPreferencesStore {
  private initialized = false
  private preferences: TranscriptionPreferences = createDefaultPreferences()

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    initDb()
    this.loadFromDb()
    this.initialized = true
  }

  get(): TranscriptionPreferences {
    return {
      providerId: this.preferences.providerId,
      modelId: this.preferences.modelId
    }
  }

  async update(input: TranscriptionPreferencesUpdateInput): Promise<TranscriptionPreferences> {
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
      .where(eq(appSettings.key, TRANSCRIPTION_PREFERENCES_SETTING_KEY))
      .get()

    if (!row) {
      this.preferences = createDefaultPreferences()
      this.persistToDb()
      return
    }

    try {
      const parsed = JSON.parse(row.valueJson) as Partial<TranscriptionPreferences>
      this.preferences = resolveLoadedPreferences(parsed)
    } catch (error) {
      console.error('[transcription] failed to parse DB preferences, using defaults', error)
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
        key: TRANSCRIPTION_PREFERENCES_SETTING_KEY,
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
