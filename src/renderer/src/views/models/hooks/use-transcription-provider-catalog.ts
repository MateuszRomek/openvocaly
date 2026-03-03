import { useCallback, useMemo } from 'react'
import { useTranscriptionPreferencesQuery } from '../queries/transcription/use-transcription-preferences-query'

type TranscriptionPreferencesData = NonNullable<
  ReturnType<typeof useTranscriptionPreferencesQuery>['data']
>

export type TranscriptionProviderSettingsProvider =
  TranscriptionPreferencesData['config']['providers'][number]
export type TranscriptionProviderId = TranscriptionProviderSettingsProvider['id']

type UseTranscriptionProviderCatalogResult = {
  isLoading: boolean
  hasError: boolean
  providers: TranscriptionProviderSettingsProvider[]
  preferredModelId: string
  selectedProviderId: string
  secureStorageAvailable: boolean
  findAvailableProvider: (
    providerId: TranscriptionProviderId
  ) => TranscriptionProviderSettingsProvider | null
}

export function useTranscriptionProviderCatalog(): UseTranscriptionProviderCatalogResult {
  const preferencesQuery = useTranscriptionPreferencesQuery()

  const preferences = preferencesQuery.data?.preferences
  const transcriptionConfig = preferencesQuery.data?.config
  const providers = useMemo(() => transcriptionConfig?.providers ?? [], [transcriptionConfig])

  const selectedProvider =
    providers.find((provider) => provider.id === preferences?.providerId) ?? providers[0]

  const availableProvidersById = useMemo(
    () =>
      new Map(
        providers
          .filter((provider) => provider.availability === 'available')
          .map((provider) => [provider.id, provider])
      ),
    [providers]
  )

  const findAvailableProvider = useCallback(
    (providerId: TranscriptionProviderId): TranscriptionProviderSettingsProvider | null =>
      availableProvidersById.get(providerId) ?? null,
    [availableProvidersById]
  )

  return {
    isLoading: preferencesQuery.isPending,
    hasError: preferencesQuery.isError,
    providers,
    preferredModelId: preferences?.modelId ?? '',
    selectedProviderId: selectedProvider?.id ?? '',
    secureStorageAvailable: transcriptionConfig?.secureStorageAvailable ?? false,
    findAvailableProvider
  }
}
