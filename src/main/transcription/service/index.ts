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
import { parakeetRuntime } from '../local/parakeet/runtime'
import { TranscriptionProviderFactory } from '../provider-factory'
import { TranscriptionPreferencesStore } from './preferences-store'
import { TranscriptionProviderCredentialsStore } from './provider-credentials-store'
import { TranscriptStore } from './transcript-store'

class TranscriptionService {
  private initialized = false
  private readonly preferencesStore = new TranscriptionPreferencesStore()
  private readonly credentialsStore = new TranscriptionProviderCredentialsStore()
  private readonly transcriptStore = new TranscriptStore()
  private readonly providerFactory = new TranscriptionProviderFactory(this.credentialsStore)

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    await this.preferencesStore.initialize()
    await this.credentialsStore.initialize()
    await this.transcriptStore.initialize()
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
    const preferences = this.preferencesStore.get()

    return {
      preferences,
      config: this.providerFactory.buildConfig(preferences)
    }
  }

  async updatePreferences(
    input: TranscriptionPreferencesUpdateInput
  ): Promise<TranscriptionPreferencesResponse> {
    await this.initialize()
    const previousPreferences = this.preferencesStore.get()
    const preferences = await this.preferencesStore.update(input)

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
    input: TranscriptionProviderApiKeyUpdateInput
  ): Promise<TranscriptionProviderApiKeyMutationResponse> {
    return this.credentialsStore.setApiKey(input)
  }

  async clearProviderApiKey(
    providerId: TranscriptionProviderApiKeyUpdateInput['providerId']
  ): Promise<TranscriptionProviderApiKeyMutationResponse> {
    return this.credentialsStore.clearApiKey(providerId)
  }

  async listLocalModels(): Promise<ListLocalModelsResponse> {
    return parakeetRuntime.listModels()
  }

  async downloadLocalModel(
    input: LocalModelActionInput,
    onProgress?: (progress: LocalModelDownloadProgress) => void
  ): Promise<LocalModelActionResponse> {
    return parakeetRuntime.downloadModel(input, onProgress)
  }

  cancelLocalModelDownload(): LocalModelActionResponse {
    return parakeetRuntime.cancelDownload()
  }

  async deleteLocalModel(input: LocalModelActionInput): Promise<LocalModelActionResponse> {
    return parakeetRuntime.deleteModel(input)
  }

  getLocalRuntimeStatus(): LocalRuntimeStatusResponse {
    return parakeetRuntime.getRuntimeStatus()
  }

  async startLocalRuntime(input: LocalModelActionInput): Promise<LocalModelActionResponse> {
    return parakeetRuntime.startRuntime(input)
  }

  async stopLocalRuntime(): Promise<LocalModelActionResponse> {
    return parakeetRuntime.stopRuntime()
  }

  async transcribeArtifact(artifact: RecordingArtifact): Promise<TranscriptionResult> {
    await this.initialize()

    const result = await this.providerFactory.transcribe(artifact, this.preferencesStore.get())

    if (!result.ok) {
      return result
    }

    try {
      await this.transcriptStore.saveFromArtifact(artifact, result.transcript)
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

export const transcriptionService = new TranscriptionService()
