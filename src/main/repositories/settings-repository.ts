import { eq } from 'drizzle-orm'
import { appSettings } from '../../shared/schema'
import { getDb } from '../db'

/**
 * Repository for persisted JSON settings backed by `app_settings` table.
 */
export class SettingsRepository {
  getValueJson(settingKey: string): string | null {
    const db = getDb()
    const row = db
      .select({ valueJson: appSettings.valueJson })
      .from(appSettings)
      .where(eq(appSettings.key, settingKey))
      .get()

    return row?.valueJson ?? null
  }

  upsertValueJson(settingKey: string, valueJson: string): void {
    const db = getDb()
    const updatedAt = Date.now()

    db.insert(appSettings)
      .values({
        key: settingKey,
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
