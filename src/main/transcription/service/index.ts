import type { RecordingArtifact } from '../../../shared/recording'
import type {
  ListLocalModelsResponse,
  LocalModelActionInput,
  LocalModelActionResponse,
  LocalModelDownloadProgress,
  LocalRuntimeStatusResponse
} from '../../../shared/local-transcription'
import type {
  TranscriptionPreferences,
  TranscriptionPreferencesResponse,
  TranscriptionPreferencesUpdateInput,
  TranscriptionProviderApiKeyMutationResponse,
  TranscriptionProviderApiKeyUpdateInput,
  TranscriptionResult
} from '../../../shared/transcription'
import { SettingsRepository } from '../../repositories/settings-repository'
import { StorageRepository } from '../../repositories/storage-repository'
import { InitializableComponent } from '../../helpers/initializable-component'
import { parakeetRuntime } from '../local/parakeet/runtime'
import { TranscriptionProviderFactory } from '../provider-factory'
import { TranscriptionPreferencesManager } from './preferences-manager'
import { TranscriptionProviderCredentialsManager } from './provider-credentials-manager'

export class TranscriptionService extends InitializableComponent {
  private readonly preferencesManager: TranscriptionPreferencesManager
  private readonly credentialsManager: TranscriptionProviderCredentialsManager
  private readonly storageRepository: StorageRepository
  private readonly providerFactory: TranscriptionProviderFactory

  constructor(
    options: {
      settingsRepository?: SettingsRepository
      storageRepository?: StorageRepository
      preferencesManager?: TranscriptionPreferencesManager
      credentialsManager?: TranscriptionProviderCredentialsManager
    } = {}
  ) {
    super('TranscriptionService')
    const settingsRepository = options.settingsRepository ?? new SettingsRepository()
    this.storageRepository = options.storageRepository ?? new StorageRepository()

    this.preferencesManager =
      options.preferencesManager ?? new TranscriptionPreferencesManager(settingsRepository)
    this.credentialsManager =
      options.credentialsManager ?? new TranscriptionProviderCredentialsManager(settingsRepository)
    this.providerFactory = new TranscriptionProviderFactory(this.credentialsManager)
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    await this.preferencesManager.initialize()
    await this.credentialsManager.initialize()
    this.initialized = true
  }

  async shutdown(): Promise<void> {
    try {
      await parakeetRuntime.stopRuntime()
    } catch (error) {
      console.error('[transcription] failed to stop local runtime during shutdown', error)
    }

    this.initialized = false
  }

  getPreferences(): TranscriptionPreferencesResponse {
    this.assertInitialized()
    const preferences = this.preferencesManager.get()

    return {
      preferences,
      config: this.providerFactory.buildConfig(preferences)
    }
  }

  async updatePreferences(
    params: TranscriptionPreferencesUpdateInput
  ): Promise<TranscriptionPreferencesResponse> {
    this.assertInitialized()
    const previousPreferences = this.preferencesManager.get()
    const preferences = await this.preferencesManager.update(params)

    if (this.shouldStopLocalRuntime(previousPreferences, preferences)) {
      await parakeetRuntime.stopRuntime()
    }

    return {
      preferences,
      config: this.providerFactory.buildConfig(preferences)
    }
  }

  private shouldStopLocalRuntime(
    previousPreferences: TranscriptionPreferences,
    nextPreferences: TranscriptionPreferences
  ): boolean {
    const previousWasLocal = previousPreferences.providerId === 'local-parakeet'
    if (!previousWasLocal) {
      return false
    }

    const switchedAwayFromLocal = nextPreferences.providerId !== 'local-parakeet'
    const switchedLocalModel = nextPreferences.modelId !== previousPreferences.modelId
    return switchedAwayFromLocal || switchedLocalModel
  }

  async setProviderApiKey(
    params: TranscriptionProviderApiKeyUpdateInput
  ): Promise<TranscriptionProviderApiKeyMutationResponse> {
    this.assertInitialized()
    return this.credentialsManager.setApiKey(params)
  }

  async clearProviderApiKey(
    providerId: TranscriptionProviderApiKeyUpdateInput['providerId']
  ): Promise<TranscriptionProviderApiKeyMutationResponse> {
    this.assertInitialized()
    return this.credentialsManager.clearApiKey(providerId)
  }

  async listLocalModels(): Promise<ListLocalModelsResponse> {
    return parakeetRuntime.listModels()
  }

  async downloadLocalModel(
    params: LocalModelActionInput,
    onProgress?: (progress: LocalModelDownloadProgress) => void
  ): Promise<LocalModelActionResponse> {
    return parakeetRuntime.downloadModel(params, onProgress)
  }

  cancelLocalModelDownload(): LocalModelActionResponse {
    return parakeetRuntime.cancelDownload()
  }

  async deleteLocalModel(params: LocalModelActionInput): Promise<LocalModelActionResponse> {
    return parakeetRuntime.deleteModel(params)
  }

  getLocalRuntimeStatus(): LocalRuntimeStatusResponse {
    return parakeetRuntime.getRuntimeStatus()
  }

  async startLocalRuntime(params: LocalModelActionInput): Promise<LocalModelActionResponse> {
    return parakeetRuntime.startRuntime(params)
  }

  async stopLocalRuntime(): Promise<LocalModelActionResponse> {
    return parakeetRuntime.stopRuntime()
  }

  async transcribeArtifact(artifact: RecordingArtifact): Promise<TranscriptionResult> {
    this.assertInitialized()

    const result = await this.providerFactory.transcribe(artifact, this.preferencesManager.get())

    if (!result.ok) {
      return result
    }

    try {
      await this.storageRepository.createSessionWithTranscriptAndMetrics(
        {
          startedAt: artifact.startedAt,
          durationMs: artifact.durationMs ?? null,
          title: null,
          source: `recording:${artifact.sessionId}`
        },
        {
          createdAt: Date.now(),
          text: result.transcript.text,
          language: result.transcript.language ?? null,
          confidence: result.transcript.confidence ?? null,
          durationMs: result.transcript.durationMs ?? artifact.durationMs ?? null
        }
      )

      return result
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to persist transcription to database.'

      return {
        ok: false,
        code: 'storage_failed',
        message
      }
    }
  }
}
