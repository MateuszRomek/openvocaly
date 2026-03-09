import { useMemo } from 'react'
import { MODELS_COPY } from '../constants/copy'
import {
  LOCAL_PARAKEET_PROVIDER_ID,
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
import type { LocalModelCardItem, LocalModelDownloadProgress } from '../types/local-models'

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
  activeDownloadModelId: string | null
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
  const localModelsQuery = useLocalModelsQuery(LOCAL_PARAKEET_PROVIDER_ID)
  const localRuntimeWarning = useLocalRuntimeWarning(LOCAL_PARAKEET_PROVIDER_ID)
  const localProviderActions = useLocalProviderActions()
  const { activeDownloadModelId, downloadProgress } = useLocalModelDownloadProgress()

  const requestError = useMemo(() => {
    if (localProviderActions.actionError) {
      return localProviderActions.actionError
    }

    if (providerCatalog.hasError) {
      return MODELS_COPY.errors.loadSettings
    }

    const modelsError = toErrorMessage(localModelsQuery.error)
    if (modelsError) {
      return modelsError
    }

    return toErrorMessage(localRuntimeWarning.runtimeError)
  }, [
    localModelsQuery.error,
    localProviderActions.actionError,
    localRuntimeWarning.runtimeError,
    providerCatalog.hasError
  ])

  const providerSections = useMemo<LocalProviderSection[]>(() => {
    return providerCatalog.providers.map((provider) => {
      const isManagedProvider = supportsLocalRuntimeActions(provider.id)

      return {
        provider,
        isSelected: provider.id === providerCatalog.selectedProviderId,
        models: getLocalProviderModels(
          provider,
          isManagedProvider ? localModelsQuery.data?.models : undefined
        ),
        runtimeWarning: isManagedProvider ? localRuntimeWarning.warning : null,
        supportsRuntimeActions: provider.availability === 'available' && isManagedProvider
      }
    })
  }, [
    localModelsQuery.data?.models,
    localRuntimeWarning.warning,
    providerCatalog.providers,
    providerCatalog.selectedProviderId
  ])

  return {
    requestError,
    selectedModelId: providerCatalog.preferredModelId,
    activeDownloadModelId,
    downloadProgress,
    isSelectionMutating: localProviderActions.isSelectionMutating,
    providerSections,
    selectModel: localProviderActions.selectModel,
    downloadModel: localProviderActions.downloadModel,
    cancelDownload: localProviderActions.cancelDownload,
    deleteModel: localProviderActions.deleteModel
  }
}
