import { eq } from 'drizzle-orm'
import { appSettings } from '../../shared/schema'
import { getDb } from '../db'

/**
 * Repository for persisted JSON settings backed by `app_settings` table.
 */
export class SettingsRepository {
  async getValueJson(settingKey: string): Promise<string | null> {
    const db = getDb()
    const row = await db
      .select({ valueJson: appSettings.valueJson })
      .from(appSettings)
      .where(eq(appSettings.key, settingKey))
      .get()

    return row?.valueJson ?? null
  }

  async upsertValueJson(settingKey: string, valueJson: string): Promise<void> {
    const db = getDb()
    const updatedAt = Date.now()

    await db
      .insert(appSettings)
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
