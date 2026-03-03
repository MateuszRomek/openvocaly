import { safeStorage } from 'electron'
import { eq } from 'drizzle-orm'
import { getDb, initDb } from '../../db'
import type {
  TranscriptionProviderApiKeyMutationResponse,
  TranscriptionProviderApiKeyUpdateInput,
  TranscriptionProviderId
} from '../../../shared/transcription'
import { appSettings } from '../../../shared/schema'

const PROVIDER_CREDENTIALS_SETTING_KEY = 'transcription.provider_credentials'

type PersistedProviderCredential = {
  encryptedApiKey: string
  updatedAt: number
}

type PersistedProviderCredentialsMap = Partial<
  Record<TranscriptionProviderId, PersistedProviderCredential>
>

/**
 * Persists cloud-provider credentials encrypted with Electron safeStorage.
 * Only encrypted payloads are stored in SQLite.
 */
export class TranscriptionProviderCredentialsStore {
  private initialized = false
  private credentials: PersistedProviderCredentialsMap = {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    initDb()
    this.loadFromDb()
    this.initialized = true
  }

  isSecureStorageAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  hasApiKey(providerId: TranscriptionProviderId): boolean {
    const entry = this.credentials[providerId]
    return Boolean(entry?.encryptedApiKey)
  }

  getApiKeyPreview(providerId: TranscriptionProviderId): string | null {
    const apiKey = this.getApiKey(providerId)
    if (!apiKey) {
      return null
    }

    const last4 = apiKey.slice(-4)
    return last4.length > 0 ? `••••${last4}` : '••••'
  }

  getApiKey(providerId: TranscriptionProviderId): string | null {
    const encryptedApiKey = this.credentials[providerId]?.encryptedApiKey
    if (!encryptedApiKey) {
      return null
    }

    if (!this.isSecureStorageAvailable()) {
      return null
    }

    try {
      const decrypted = safeStorage.decryptString(Buffer.from(encryptedApiKey, 'base64'))
      const normalized = decrypted.trim()
      return normalized.length > 0 ? normalized : null
    } catch (error) {
      console.error('[transcription] failed to decrypt provider api key', error)
      return null
    }
  }

  async setApiKey(
    input: TranscriptionProviderApiKeyUpdateInput
  ): Promise<TranscriptionProviderApiKeyMutationResponse> {
    await this.initialize()

    const normalizedApiKey = input.apiKey.trim()
    if (normalizedApiKey.length === 0) {
      return {
        ok: false,
        message: 'API key cannot be empty.'
      }
    }

    if (!this.isSecureStorageAvailable()) {
      return {
        ok: false,
        message:
          'Secure key storage is unavailable on this device. API keys cannot be saved securely.'
      }
    }

    try {
      const encryptedApiKey = safeStorage.encryptString(normalizedApiKey).toString('base64')
      this.credentials[input.providerId] = {
        encryptedApiKey,
        updatedAt: Date.now()
      }
      this.persistToDb()

      return { ok: true }
    } catch (error) {
      console.error('[transcription] failed to encrypt provider api key', error)
      return {
        ok: false,
        message: 'Failed to save API key securely. Please try again.'
      }
    }
  }

  async clearApiKey(
    providerId: TranscriptionProviderId
  ): Promise<TranscriptionProviderApiKeyMutationResponse> {
    await this.initialize()
    delete this.credentials[providerId]
    this.persistToDb()
    return { ok: true }
  }

  private loadFromDb(): void {
    const db = getDb()
    const row = db
      .select({ valueJson: appSettings.valueJson })
      .from(appSettings)
      .where(eq(appSettings.key, PROVIDER_CREDENTIALS_SETTING_KEY))
      .get()

    if (!row) {
      this.credentials = {}
      return
    }

    try {
      const parsed = JSON.parse(row.valueJson) as PersistedProviderCredentialsMap
      this.credentials = parsed ?? {}
    } catch (error) {
      console.error('[transcription] failed to parse provider credentials, resetting', error)
      this.credentials = {}
      this.persistToDb()
    }
  }

  private persistToDb(): void {
    const db = getDb()
    const valueJson = JSON.stringify(this.credentials)
    const updatedAt = Date.now()

    db.insert(appSettings)
      .values({
        key: PROVIDER_CREDENTIALS_SETTING_KEY,
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
