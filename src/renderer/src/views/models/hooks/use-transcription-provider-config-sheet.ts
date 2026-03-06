import { useCallback, useMemo, useState } from 'react'
import {
  useCloudTranscriptionProviderCatalog,
  type TranscriptionProviderId,
  type TranscriptionProviderSettingsProvider
} from './use-transcription-provider-catalog'

type UseTranscriptionProviderConfigSheetResult = {
  providers: TranscriptionProviderSettingsProvider[]
  provider: TranscriptionProviderSettingsProvider | null
  secureStorageAvailable: boolean
  sheetModelValue: string
  sheetApiKeyDraft: string
  hasDraftApiKey: boolean
  isDraftApiKeyVisible: boolean
  canSaveSheetApiKey: boolean
  setApiKeyDraft: (value: string) => void
  resetApiKeyDraft: () => void
  toggleApiKeyVisibility: () => void
}

export function useTranscriptionProviderConfigSheet(
  providerId: TranscriptionProviderId | null
): UseTranscriptionProviderConfigSheetResult {
  const { providers, preferredModelId, secureStorageAvailable, findAvailableProvider } =
    useCloudTranscriptionProviderCatalog()

  const provider = useMemo(() => {
    if (!providerId) {
      return null
    }

    return findAvailableProvider(providerId)
  }, [findAvailableProvider, providerId])

  const [apiKeyDraft, setApiKeyDraftState] = useState('')
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false)

  const sheetModelValue = useMemo(() => {
    if (!provider) {
      return ''
    }

    return (
      provider.models.find((model) => model.id === preferredModelId)?.id ??
      provider.models[0]?.id ??
      ''
    )
  }, [preferredModelId, provider])

  const sheetApiKeyDraft = useMemo(() => (provider ? apiKeyDraft : ''), [apiKeyDraft, provider])
  const hasDraftApiKey = useMemo(() => sheetApiKeyDraft.trim().length > 0, [sheetApiKeyDraft])

  const isDraftApiKeyVisible = useMemo(() => {
    if (!provider) {
      return false
    }

    return isApiKeyVisible && hasDraftApiKey
  }, [hasDraftApiKey, isApiKeyVisible, provider])

  const canSaveSheetApiKey = useMemo(
    () => secureStorageAvailable && hasDraftApiKey,
    [hasDraftApiKey, secureStorageAvailable]
  )

  const setApiKeyDraft = useCallback(
    (value: string) => {
      if (!provider) {
        return
      }

      setApiKeyDraftState(value)
    },
    [provider]
  )

  const resetApiKeyDraft = useCallback(() => {
    if (!provider) {
      return
    }

    setApiKeyDraftState('')
    setIsApiKeyVisible(false)
  }, [provider])

  const toggleApiKeyVisibility = useCallback(() => {
    if (!provider) {
      return
    }

    setIsApiKeyVisible((previous) => !previous)
  }, [provider])

  return {
    providers,
    provider,
    secureStorageAvailable,
    sheetModelValue,
    sheetApiKeyDraft,
    hasDraftApiKey,
    isDraftApiKeyVisible,
    canSaveSheetApiKey,
    setApiKeyDraft,
    resetApiKeyDraft,
    toggleApiKeyVisibility
  }
}
