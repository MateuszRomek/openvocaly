import type {
  TranscriptionConfig,
  TranscriptionFailureCode,
  TranscriptionPreferences,
  TranscriptionProviderOption,
  TranscriptionResult
} from '../../shared/transcription'
import { resolveTranscriptionModelId } from './provider-helpers'
import { transcriptionProviders, transcriptionProvidersById } from './providers'
import type { TranscriptionArtifact, TranscriptionProviderDefinition } from './providers/types'

export class TranscriptionProviderFactory {
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
    const isActiveProvider = preferences?.providerId === provider.id
    if (isActiveProvider) {
      return provider.isModelDownloaded(modelId)
    }

    return provider.models.some((model) => provider.isModelDownloaded(model.id))
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

    return {
      ok: false,
      code,
      message: `${providerLabel} is not configured.`
    }
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
          downloaded: provider.isModelDownloaded(model.id)
        })),
        isConfigured: this.isProviderConfigured(provider, preferences),
        availability: provider.availability
      } as const

      return {
        ...base,
        kind: 'local'
      }
    })

    return {
      providers: options
    }
  }

  async validateLocalSelection(
    preferences: TranscriptionPreferences
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const provider = transcriptionProvidersById.get(preferences.providerId)
    if (!provider) {
      return { ok: false, message: 'Selected transcription provider is not supported.' }
    }

    if (provider.availability !== 'available') {
      return { ok: false, message: `${provider.label} transcription is not available yet.` }
    }

    if (!provider.models.some((model) => model.id === preferences.modelId)) {
      return { ok: false, message: 'Selected transcription model is not supported.' }
    }

    const failureCode = await provider.validateBeforeTranscribe?.({
      modelId: preferences.modelId
    })
    if (failureCode) {
      const failure = this.toMissingRequirementResult(provider.label, failureCode)
      return {
        ok: false,
        message: failure.ok
          ? `${provider.label} is not configured.`
          : (failure.message ?? `${provider.label} is not configured.`)
      }
    }

    if (!provider.isModelDownloaded(preferences.modelId)) {
      const failure = this.toMissingRequirementResult(provider.label, 'local_model_not_downloaded')
      return {
        ok: false,
        message: failure.ok
          ? `${provider.label} is not configured.`
          : (failure.message ?? `${provider.label} is not configured.`)
      }
    }

    return { ok: true }
  }

  async transcribe(
    artifact: TranscriptionArtifact,
    preferences: TranscriptionPreferences,
    options: { signal?: AbortSignal } = {}
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
      if (!provider.isModelDownloaded(modelId)) {
        return this.toMissingRequirementResult(provider.label, 'local_model_not_downloaded')
      }

      return await provider.transcribe(artifact, { modelId, signal: options.signal })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown provider error.'
      return this.toProviderFailureMessage(provider.label, message, 'local_transcription_failed')
    }
  }
}
