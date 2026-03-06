import { useMemo } from 'react'
import { MODELS_COPY } from '../constants/copy'
import {
  useCloudTranscriptionProviderCatalog,
  type TranscriptionProviderId,
  type TranscriptionProviderSettingsProvider
} from './use-transcription-provider-catalog'
import { useTranscriptionProviderSelectionActions } from './use-transcription-provider-selection-actions'

type UseTranscriptionProviderSettingsResult = {
  isLoading: boolean
  requestError: string | null
  providers: TranscriptionProviderSettingsProvider[]
  selectedProviderId: string
  selectedModelId: string
  isSelectionMutating: boolean
  setProvider: (providerId: TranscriptionProviderId) => void
}

export type { TranscriptionProviderSettingsProvider } from './use-transcription-provider-catalog'

export function useTranscriptionProviderSettings(): UseTranscriptionProviderSettingsResult {
  const providerCatalog = useCloudTranscriptionProviderCatalog()
  const selectionActions = useTranscriptionProviderSelectionActions(providerCatalog.providers)

  const requestError = useMemo(() => {
    if (providerCatalog.hasError) {
      return MODELS_COPY.errors.loadSettings
    }

    if (selectionActions.hasError) {
      return MODELS_COPY.errors.saveProviderSettings
    }

    return null
  }, [providerCatalog.hasError, selectionActions.hasError])

  return {
    isLoading: providerCatalog.isLoading,
    requestError,
    providers: providerCatalog.providers,
    selectedProviderId: providerCatalog.selectedProviderId,
    selectedModelId: providerCatalog.preferredModelId,
    isSelectionMutating: selectionActions.isMutating,
    setProvider: selectionActions.setProvider
  }
}
