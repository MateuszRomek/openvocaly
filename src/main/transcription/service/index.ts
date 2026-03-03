import type { RecordingArtifact } from '../../../shared/recording'
import type {
  TranscriptionPreferencesResponse,
  TranscriptionPreferencesUpdateInput,
  TranscriptionProviderApiKeyMutationResponse,
  TranscriptionProviderApiKeyUpdateInput,
  TranscriptionResult
} from '../../../shared/transcription'
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
    this.initialized = false
  }

  getPreferences(): TranscriptionPreferencesResponse {
    return {
      preferences: this.preferencesStore.get(),
      config: this.providerFactory.buildConfig()
    }
  }

  async updatePreferences(
    input: TranscriptionPreferencesUpdateInput
  ): Promise<TranscriptionPreferencesResponse> {
    const preferences = await this.preferencesStore.update(input)

    return {
      preferences,
      config: this.providerFactory.buildConfig()
    }
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
