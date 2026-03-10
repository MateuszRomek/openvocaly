import { safeStorage } from 'electron'
import type {
  TranscriptionProviderApiKeyMutationResponse,
  TranscriptionProviderApiKeyUpdateInput,
  TranscriptionProviderId
} from '../../../shared/transcription'
import { SettingsRepository } from '../../repositories/settings-repository'
import { AsyncSerialScheduler } from '../../helpers/async-serial-scheduler'
import { InitializableComponent } from '../../helpers/initializable-component'

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
export class TranscriptionProviderCredentialsManager extends InitializableComponent {
  private credentials: PersistedProviderCredentialsMap = {}
  private readonly mutationScheduler = new AsyncSerialScheduler()

  constructor(private readonly settingsRepository: SettingsRepository = new SettingsRepository()) {
    super('TranscriptionProviderCredentialsManager')
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    await this.loadFromDb()
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
    this.assertInitialized()
    const entry = this.credentials[providerId]
    return Boolean(entry?.encryptedApiKey)
  }

  getApiKeyPreview(providerId: TranscriptionProviderId): string | null {
    this.assertInitialized()
    const apiKey = this.getApiKey(providerId)
    if (!apiKey) {
      return null
    }

    const last4 = apiKey.slice(-4)
    return last4.length > 0 ? `••••${last4}` : '••••'
  }

  getApiKey(providerId: TranscriptionProviderId): string | null {
    this.assertInitialized()
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
    this.assertInitialized()

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

    return await this.mutationScheduler.run(async () => {
      try {
        const encryptedApiKey = safeStorage.encryptString(normalizedApiKey).toString('base64')
        this.credentials[params.providerId] = {
          encryptedApiKey,
          updatedAt: Date.now()
        }
        await this.persistToDb()

        return { ok: true }
      } catch (error) {
        console.error('[transcription] failed to encrypt provider api key', error)
        return {
          ok: false,
          message: 'Failed to save API key securely. Please try again.'
        }
      }
    })
  }

  async clearApiKey(
    providerId: TranscriptionProviderId
  ): Promise<TranscriptionProviderApiKeyMutationResponse> {
    this.assertInitialized()
    return await this.mutationScheduler.run(async () => {
      delete this.credentials[providerId]
      await this.persistToDb()
      return { ok: true }
    })
  }

  private async loadFromDb(): Promise<void> {
    const valueJson = await this.settingsRepository.getValueJson(PROVIDER_CREDENTIALS_SETTING_KEY)

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
      await this.persistToDb()
    }
  }

  private async persistToDb(): Promise<void> {
    const valueJson = JSON.stringify(this.credentials)
    await this.settingsRepository.upsertValueJson(PROVIDER_CREDENTIALS_SETTING_KEY, valueJson)
  }
}
