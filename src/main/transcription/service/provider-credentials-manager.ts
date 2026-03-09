import { safeStorage } from 'electron'
import type {
  TranscriptionProviderApiKeyMutationResponse,
  TranscriptionProviderApiKeyUpdateInput,
  TranscriptionProviderId
} from '../../../shared/transcription'
import { SettingsRepository } from '../../repositories/settings-repository'

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
export class TranscriptionProviderCredentialsManager {
  private initialized = false
  private credentials: PersistedProviderCredentialsMap = {}

  constructor(private readonly settingsRepository: SettingsRepository = new SettingsRepository()) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

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
    params: TranscriptionProviderApiKeyUpdateInput
  ): Promise<TranscriptionProviderApiKeyMutationResponse> {
    await this.initialize()

    const normalizedApiKey = params.apiKey.trim()
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
      this.credentials[params.providerId] = {
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
    const valueJson = this.settingsRepository.getValueJson(PROVIDER_CREDENTIALS_SETTING_KEY)

    if (!valueJson) {
      this.credentials = {}
      return
    }

    try {
      const parsed = JSON.parse(valueJson) as PersistedProviderCredentialsMap
      this.credentials = parsed ?? {}
    } catch (error) {
      console.error('[transcription] failed to parse provider credentials, resetting', error)
      this.credentials = {}
      this.persistToDb()
    }
  }

  private persistToDb(): void {
    const valueJson = JSON.stringify(this.credentials)
    this.settingsRepository.upsertValueJson(PROVIDER_CREDENTIALS_SETTING_KEY, valueJson)
  }
}
