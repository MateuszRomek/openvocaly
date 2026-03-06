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
import type { TranscriptionProviderDefinition } from './providers/types'

export interface TranscriptionProviderCredentialsStore {
  isSecureStorageAvailable(): boolean
  hasApiKey(providerId: TranscriptionProviderId): boolean
  getApiKeyPreview(providerId: TranscriptionProviderId): string | null
  getApiKey(providerId: TranscriptionProviderId): string | null
}

export class TranscriptionProviderFactory {
  constructor(private readonly credentialsStore: TranscriptionProviderCredentialsStore) {}

  private resolveProviderModelId(
    provider: TranscriptionProviderDefinition,
    preferences?: TranscriptionPreferences
  ): string {
    const preferredModelId =
      preferences?.providerId === provider.id ? preferences.modelId : provider.models[0]?.id

    return resolveTranscriptionModelId(provider.id, preferredModelId)
  }

  private isProviderConfigured(
    provider: TranscriptionProviderDefinition,
    preferences?: TranscriptionPreferences
  ): boolean {
    const modelId = this.resolveProviderModelId(provider, preferences)
    if (provider.isConfigured) {
      return provider.isConfigured({ modelId })
    }

    if (provider.kind === 'cloud') {
      return this.credentialsStore.hasApiKey(provider.id)
    }

    const isActiveProvider = preferences?.providerId === provider.id
    if (isActiveProvider) {
      return provider.isModelDownloaded(modelId)
    }

    return provider.models.some((model) => provider.isModelDownloaded(model.id))
  }

  private getProviderApiKeyPreview(provider: TranscriptionProviderDefinition): string | null {
    if (provider.kind !== 'cloud') {
      return null
    }

    return this.credentialsStore.getApiKeyPreview(provider.id)
  }

  private toMissingRequirementResult(
    providerLabel: string,
    code: TranscriptionFailureCode
  ): TranscriptionResult {
    if (code === 'local_model_not_downloaded') {
      return {
        ok: false,
        code,
        message: `${providerLabel} model is not downloaded. Open Models > Local and download it first.`
      }
    }

    if (code === 'local_runtime_unavailable') {
      return {
        ok: false,
        code,
        message: `${providerLabel} runtime is unavailable. Reinstall app binaries and try again.`
      }
    }

    if (code === 'missing_api_key') {
      return {
        ok: false,
        code,
        message: `${providerLabel} is not configured. Add an API key in Settings > Transcription.`
      }
    }

    return {
      ok: false,
      code,
      message: `${providerLabel} is not configured.`
    }
  }

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

  buildConfig(preferences?: TranscriptionPreferences): TranscriptionConfig {
    const options: TranscriptionProviderOption[] = transcriptionProviders.map((provider) => {
      const base = {
        id: provider.id,
        label: provider.label,
        kind: provider.kind,
        models: provider.models.map((model) => ({
          ...model,
          downloaded: provider.kind === 'local' ? provider.isModelDownloaded(model.id) : undefined
        })),
        isConfigured: this.isProviderConfigured(provider, preferences),
        availability: provider.availability
      } as const

      if (provider.kind === 'cloud') {
        return {
          ...base,
          kind: 'cloud',
          apiKeyPreview: this.getProviderApiKeyPreview(provider)
        }
      }

      return {
        ...base,
        kind: 'local',
        apiKeyPreview: null
      }
    })

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

    const modelId = resolveTranscriptionModelId(provider.id, preferences.modelId)

    if (provider.validateBeforeTranscribe) {
      const failureCode = await provider.validateBeforeTranscribe({ modelId })
      if (failureCode) {
        return this.toMissingRequirementResult(provider.label, failureCode)
      }
    }

    try {
      if (provider.kind === 'cloud') {
        const apiKey = this.credentialsStore.getApiKey(provider.id)
        if (!apiKey) {
          return this.toMissingRequirementResult(provider.label, 'missing_api_key')
        }

        return await provider.transcribe(artifact, { apiKey, modelId })
      }

      if (!provider.isModelDownloaded(modelId)) {
        return this.toMissingRequirementResult(provider.label, 'local_model_not_downloaded')
      }

      return await provider.transcribe(artifact, { modelId })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown provider error.'
      const code =
        provider.kind === 'local'
          ? 'local_transcription_failed'
          : this.isLikelyInvalidApiKeyError(error)
            ? 'invalid_api_key'
            : 'provider_request_failed'

      return this.toProviderFailureMessage(provider.label, message, code)
    }
  }
}
