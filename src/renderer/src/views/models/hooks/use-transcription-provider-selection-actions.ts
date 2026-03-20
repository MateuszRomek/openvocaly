import { useCallback, useMemo } from 'react'
import { useUpdateTranscriptionPreferencesMutation } from '@renderer/queries/transcription/use-update-transcription-preferences-mutation'
import type {
  TranscriptionProviderId,
  TranscriptionProviderSettingsProvider
} from './use-transcription-provider-catalog'

type UseTranscriptionProviderSelectionActionsResult = {
  isMutating: boolean
  hasError: boolean
  setProvider: (providerId: TranscriptionProviderId) => void
  setModel: (providerId: TranscriptionProviderId, modelId: string) => void
}

export function useTranscriptionProviderSelectionActions(
  providers: TranscriptionProviderSettingsProvider[]
): UseTranscriptionProviderSelectionActionsResult {
  const updatePreferencesMutation = useUpdateTranscriptionPreferencesMutation()

  const availableProvidersById = useMemo(
    () =>
      new Map(
        providers
          .filter((provider) => provider.availability === 'available')
          .map((provider) => [provider.id, provider])
      ),
    [providers]
  )

  const setProvider = useCallback(
    (providerId: TranscriptionProviderId): void => {
      const provider = availableProvidersById.get(providerId)
      if (!provider) {
        return
      }

      updatePreferencesMutation.mutate({
        providerId: provider.id,
        modelId: provider.models[0]?.id ?? ''
      })
    },
    [availableProvidersById, updatePreferencesMutation]
  )

  const setModel = useCallback(
    (providerId: TranscriptionProviderId, modelId: string): void => {
      if (!modelId.length) {
        return
      }

      const provider = availableProvidersById.get(providerId)
      if (!provider || !provider.models.some((model) => model.id === modelId)) {
        return
      }

      updatePreferencesMutation.mutate({
        providerId: provider.id,
        modelId
      })
    },
    [availableProvidersById, updatePreferencesMutation]
  )

  return {
    isMutating: updatePreferencesMutation.isPending,
    hasError: updatePreferencesMutation.isError,
    setProvider,
    setModel
  }
}
