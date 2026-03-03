import { useMemo } from 'react'
import {
  type TranscriptionProviderId,
  useTranscriptionProviderCatalog,
  type TranscriptionProviderSettingsProvider
} from './use-transcription-provider-catalog'
import { useTranscriptionProviderSelectionActions } from './use-transcription-provider-selection-actions'

type UseTranscriptionProviderSettingsResult = {
  isLoading: boolean
  requestError: string | null
  providers: TranscriptionProviderSettingsProvider[]
  selectedProviderId: string
  isSelectionMutating: boolean
  setProvider: (providerId: TranscriptionProviderId) => void
}

export type { TranscriptionProviderSettingsProvider } from './use-transcription-provider-catalog'

export function useTranscriptionProviderSettings(): UseTranscriptionProviderSettingsResult {
  const providerCatalog = useTranscriptionProviderCatalog()
  const selectionActions = useTranscriptionProviderSelectionActions(providerCatalog.providers)

  const requestError = useMemo(() => {
    if (providerCatalog.hasError) {
      return 'Failed to load transcription settings.'
    }

    if (selectionActions.hasError) {
      return 'Failed to save transcription provider settings.'
    }

    return null
  }, [providerCatalog.hasError, selectionActions.hasError])

  return {
    isLoading: providerCatalog.isLoading,
    requestError,
    providers: providerCatalog.providers,
    selectedProviderId: providerCatalog.selectedProviderId,
    isSelectionMutating: selectionActions.isMutating,
    setProvider: selectionActions.setProvider
  }
}
