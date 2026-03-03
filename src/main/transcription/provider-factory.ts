import type { RecordingArtifact } from '../../shared/recording'
import type {
  TranscriptionConfig,
  TranscriptionFailureCode,
  TranscriptionPreferences,
  TranscriptionProviderId,
  TranscriptionProviderOption,
  TranscriptionResult
} from '../../shared/transcription'
import { resolveTranscriptionModelId } from './provider-helpers'
import { transcriptionProviders, transcriptionProvidersById } from './providers'

export interface TranscriptionProviderCredentialsStore {
  isSecureStorageAvailable(): boolean
  hasApiKey(providerId: TranscriptionProviderId): boolean
  getApiKeyPreview(providerId: TranscriptionProviderId): string | null
  getApiKey(providerId: TranscriptionProviderId): string | null
}

export class TranscriptionProviderFactory {
  constructor(private readonly credentialsStore: TranscriptionProviderCredentialsStore) {}

  private isLikelyInvalidApiKeyError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false
    }

    const normalizedMessage = error.message.toLowerCase()

    return (
      normalizedMessage.includes('401') ||
      normalizedMessage.includes('unauthorized') ||
      normalizedMessage.includes('forbidden') ||
      normalizedMessage.includes('invalid api key') ||
      normalizedMessage.includes('invalid_api_key') ||
      normalizedMessage.includes('authentication')
    )
  }

  private toProviderFailureMessage(
    providerLabel: string,
    message: string,
    code: TranscriptionFailureCode
  ): TranscriptionResult {
    return {
      ok: false,
      code,
      message: `${providerLabel} request failed: ${message}`
    }
  }

  buildConfig(): TranscriptionConfig {
    const options: TranscriptionProviderOption[] = transcriptionProviders.map((provider) => ({
      id: provider.id,
      label: provider.label,
      models: provider.models.map((model) => ({ ...model })),
      isConfigured: this.credentialsStore.hasApiKey(provider.id),
      apiKeyPreview: this.credentialsStore.getApiKeyPreview(provider.id),
      availability: provider.availability
    }))

    return {
      secureStorageAvailable: this.credentialsStore.isSecureStorageAvailable(),
      providers: options
    }
  }

  async transcribe(
    artifact: RecordingArtifact,
    preferences: TranscriptionPreferences
  ): Promise<TranscriptionResult> {
    if (process.env['OPENVOCALY_RECORDING_FORCE_TRANSCRIPTION_FAILURE'] === '1') {
      return {
        ok: false,
        code: 'forced_failure',
        message:
          'Forced transcription failure from OPENVOCALY_RECORDING_FORCE_TRANSCRIPTION_FAILURE=1'
      }
    }

    const providerId = preferences.providerId
    const provider = transcriptionProvidersById.get(providerId)

    if (!provider) {
      return {
        ok: false,
        code: 'provider_not_supported',
        message: 'Selected transcription provider is not supported.'
      }
    }

    if (provider.availability !== 'available' || !provider.transcribe) {
      return {
        ok: false,
        code: 'provider_unavailable',
        message: `${provider.label} transcription is not available yet.`
      }
    }

    const apiKey = this.credentialsStore.getApiKey(provider.id)
    if (!apiKey) {
      return {
        ok: false,
        code: 'provider_not_configured',
        message: `${provider.label} is not configured. Add an API key in Settings > Transcription.`
      }
    }

    const modelId = resolveTranscriptionModelId(provider.id, preferences.modelId)

    try {
      return await provider.transcribe(artifact, { apiKey, modelId })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown provider error.'
      const code = this.isLikelyInvalidApiKeyError(error)
        ? 'invalid_api_key'
        : 'provider_request_failed'

      return this.toProviderFailureMessage(provider.label, message, code)
    }
  }
}
