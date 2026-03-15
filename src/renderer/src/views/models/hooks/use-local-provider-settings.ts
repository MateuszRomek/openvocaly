import { useMemo } from 'react'
import { MODELS_COPY } from '../constants/copy'
import {
  LOCAL_PARAKEET_PROVIDER_ID,
  LOCAL_WHISPER_PROVIDER_ID,
  supportsLocalRuntimeActions
} from '../constants/local-provider-capabilities'
import { getLocalProviderModels } from '../helpers/local-provider-models'
import { useLocalModelDownloadProgress } from './use-local-model-download-progress'
import { useLocalProviderActions } from './use-local-provider-actions'
import {
  useLocalTranscriptionProviderCatalog,
  type TranscriptionProviderId,
  type TranscriptionProviderSettingsProvider
} from './use-transcription-provider-catalog'
import { useLocalModelsQuery } from '../queries/transcription/use-local-models-query'
import { useLocalRuntimeWarning } from './use-local-runtime-warning'
import type {
  LocalModelCardItem,
  LocalModelDownloadProgress,
  LocalModelInfo
} from '../types/local-models'

export type LocalProviderSection = {
  provider: TranscriptionProviderSettingsProvider
  isSelected: boolean
  models: LocalModelCardItem[]
  runtimeWarning: string | null
  supportsRuntimeActions: boolean
}

type UseLocalProviderSettingsResult = {
  requestError: string | null
  selectedModelId: string
  activeDownload: {
    providerId: LocalModelDownloadProgress['providerId']
    modelId: LocalModelDownloadProgress['modelId']
  } | null
  downloadProgress: LocalModelDownloadProgress | null
  isSelectionMutating: boolean
  providerSections: LocalProviderSection[]
  selectModel: (providerId: TranscriptionProviderId, modelId: string) => void
  downloadModel: (providerId: TranscriptionProviderId, modelId: string) => Promise<void>
  cancelDownload: (providerId: TranscriptionProviderId) => Promise<void>
  deleteModel: (providerId: TranscriptionProviderId, modelId: string) => Promise<void>
}

const toErrorMessage = (error: unknown): string | null => {
  return error instanceof Error ? error.message : null
}

export type { TranscriptionProviderSettingsProvider } from './use-transcription-provider-catalog'

export function useLocalProviderSettings(): UseLocalProviderSettingsResult {
  const providerCatalog = useLocalTranscriptionProviderCatalog()
  const hasParakeetProvider = providerCatalog.providers.some(
    (provider) => provider.id === LOCAL_PARAKEET_PROVIDER_ID
  )
  const hasWhisperProvider = providerCatalog.providers.some(
    (provider) => provider.id === LOCAL_WHISPER_PROVIDER_ID
  )

  const parakeetModelsQuery = useLocalModelsQuery(LOCAL_PARAKEET_PROVIDER_ID, {
    enabled: hasParakeetProvider
  })
  const whisperModelsQuery = useLocalModelsQuery(LOCAL_WHISPER_PROVIDER_ID, {
    enabled: hasWhisperProvider
  })

  const parakeetRuntimeWarning = useLocalRuntimeWarning(LOCAL_PARAKEET_PROVIDER_ID, {
    enabled: hasParakeetProvider
  })
  const whisperRuntimeWarning = useLocalRuntimeWarning(LOCAL_WHISPER_PROVIDER_ID, {
    enabled: hasWhisperProvider
  })

  const localProviderActions = useLocalProviderActions()
  const { activeDownload, downloadProgress } = useLocalModelDownloadProgress()

  const managedModelsByProviderId = useMemo<
    Partial<Record<TranscriptionProviderId, LocalModelInfo[] | undefined>>
  >(
    () => ({
      [LOCAL_PARAKEET_PROVIDER_ID]: parakeetModelsQuery.data?.models,
      [LOCAL_WHISPER_PROVIDER_ID]: whisperModelsQuery.data?.models
    }),
    [parakeetModelsQuery.data?.models, whisperModelsQuery.data?.models]
  )

  const runtimeWarningsByProviderId = useMemo<
    Partial<Record<TranscriptionProviderId, string | null>>
  >(
    () => ({
      [LOCAL_PARAKEET_PROVIDER_ID]: parakeetRuntimeWarning.warning,
      [LOCAL_WHISPER_PROVIDER_ID]: whisperRuntimeWarning.warning
    }),
    [parakeetRuntimeWarning.warning, whisperRuntimeWarning.warning]
  )

  const requestError = useMemo(() => {
    if (localProviderActions.actionError) {
      return localProviderActions.actionError
    }

    if (providerCatalog.hasError) {
      return MODELS_COPY.errors.loadSettings
    }

    for (const queryError of [parakeetModelsQuery.error, whisperModelsQuery.error]) {
      const modelsError = toErrorMessage(queryError)
      if (modelsError) {
        return modelsError
      }
    }

    for (const runtimeError of [
      parakeetRuntimeWarning.runtimeError,
      whisperRuntimeWarning.runtimeError
    ]) {
      const warningError = toErrorMessage(runtimeError)
      if (warningError) {
        return warningError
      }
    }

    return null
  }, [
    localProviderActions.actionError,
    parakeetModelsQuery.error,
    parakeetRuntimeWarning.runtimeError,
    providerCatalog.hasError,
    whisperModelsQuery.error,
    whisperRuntimeWarning.runtimeError
  ])

  const providerSections = useMemo<LocalProviderSection[]>(() => {
    return providerCatalog.providers.map((provider) => {
      const isManagedProvider = supportsLocalRuntimeActions(provider.id)

      return {
        provider,
        isSelected: provider.id === providerCatalog.selectedProviderId,
        models: getLocalProviderModels(
          provider,
          isManagedProvider ? managedModelsByProviderId[provider.id] : undefined
        ),
        runtimeWarning: isManagedProvider
          ? (runtimeWarningsByProviderId[provider.id] ?? null)
          : null,
        supportsRuntimeActions: provider.availability === 'available' && isManagedProvider
      }
    })
  }, [
    managedModelsByProviderId,
    providerCatalog.providers,
    providerCatalog.selectedProviderId,
    runtimeWarningsByProviderId
  ])

  return {
    requestError,
    selectedModelId: providerCatalog.preferredModelId,
    activeDownload,
    downloadProgress,
    isSelectionMutating: localProviderActions.isSelectionMutating,
    providerSections,
    selectModel: localProviderActions.selectModel,
    downloadModel: localProviderActions.downloadModel,
    cancelDownload: localProviderActions.cancelDownload,
    deleteModel: localProviderActions.deleteModel
  }
}
