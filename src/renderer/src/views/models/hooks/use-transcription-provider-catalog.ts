import { useCallback, useMemo } from 'react'
import { useTranscriptionPreferencesQuery } from '@renderer/queries/transcription/use-transcription-preferences-query'

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
  findAvailableProvider: (
    providerId: TranscriptionProviderId
  ) => TranscriptionProviderSettingsProvider | null
}

export const useLocalTranscriptionProviderCatalog = (): UseTranscriptionProviderCatalogResult => {
  const preferencesQuery = useTranscriptionPreferencesQuery()

  const preferences = preferencesQuery.data?.preferences
  const transcriptionConfig = preferencesQuery.data?.config
  const providers = useMemo(() => {
    return transcriptionConfig?.providers ?? []
  }, [transcriptionConfig])

  const selectedProviderId = preferences?.providerId ?? providers[0]?.id ?? ''

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
    selectedProviderId,
    findAvailableProvider
  }
}
