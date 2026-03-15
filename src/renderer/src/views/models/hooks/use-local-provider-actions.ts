import { useCallback, useState } from 'react'
import { useUpdateTranscriptionPreferencesMutation } from '../queries/transcription/use-update-transcription-preferences-mutation'
import { useCancelLocalModelDownloadMutation } from '../queries/transcription/use-cancel-local-model-download-mutation'
import { useDeleteLocalModelMutation } from '../queries/transcription/use-delete-local-model-mutation'
import { useDownloadLocalModelMutation } from '../queries/transcription/use-download-local-model-mutation'
import type { TranscriptionProviderId } from './use-transcription-provider-catalog'
import type { LocalModelId } from '../types/local-models'
import { supportsLocalRuntimeActions } from '../constants/local-provider-capabilities'

export type UseLocalProviderActionsResult = {
  actionError: string | null
  isSelectionMutating: boolean
  selectModel: (providerId: TranscriptionProviderId, modelId: LocalModelId) => void
  downloadModel: (providerId: TranscriptionProviderId, modelId: LocalModelId) => Promise<void>
  cancelDownload: (providerId: TranscriptionProviderId) => Promise<void>
  deleteModel: (providerId: TranscriptionProviderId, modelId: LocalModelId) => Promise<void>
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  return error instanceof Error ? error.message : fallback
}

const getUnsupportedProviderMessage = (providerId: TranscriptionProviderId): string => {
  return `Local model actions are not implemented for provider "${providerId}" yet.`
}

const GLOBAL_LOCAL_DOWNLOAD_LOCK_MESSAGE = 'Another local model download is already in progress.'

export function useLocalProviderActions(): UseLocalProviderActionsResult {
  const [actionError, setActionError] = useState<string | null>(null)
  const updatePreferencesMutation = useUpdateTranscriptionPreferencesMutation()
  const downloadMutation = useDownloadLocalModelMutation()
  const cancelDownloadMutation = useCancelLocalModelDownloadMutation()
  const deleteMutation = useDeleteLocalModelMutation()

  const selectModel = useCallback(
    (providerId: TranscriptionProviderId, modelId: LocalModelId): void => {
      setActionError(null)

      if (!supportsLocalRuntimeActions(providerId)) {
        setActionError(getUnsupportedProviderMessage(providerId))
        return
      }

      updatePreferencesMutation.mutate(
        {
          providerId,
          modelId
        },
        {
          onError: (error) => {
            setActionError(getErrorMessage(error, 'Failed to set active local model.'))
          }
        }
      )
    },
    [updatePreferencesMutation]
  )

  const downloadModel = useCallback(
    async (providerId: TranscriptionProviderId, modelId: LocalModelId): Promise<void> => {
      setActionError(null)

      if (!supportsLocalRuntimeActions(providerId)) {
        setActionError(getUnsupportedProviderMessage(providerId))
        return
      }

      try {
        await downloadMutation.mutateAsync({
          providerId,
          modelId
        })
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to download local model.')
        if (message.includes(GLOBAL_LOCAL_DOWNLOAD_LOCK_MESSAGE)) {
          return
        }
        setActionError(message)
      }
    },
    [downloadMutation]
  )

  const cancelDownload = useCallback(
    async (providerId: TranscriptionProviderId): Promise<void> => {
      setActionError(null)

      if (!supportsLocalRuntimeActions(providerId)) {
        setActionError(getUnsupportedProviderMessage(providerId))
        return
      }

      try {
        await cancelDownloadMutation.mutateAsync({ providerId })
      } catch (error) {
        setActionError(getErrorMessage(error, 'Failed to cancel download.'))
      }
    },
    [cancelDownloadMutation]
  )

  const deleteModel = useCallback(
    async (providerId: TranscriptionProviderId, modelId: LocalModelId): Promise<void> => {
      setActionError(null)

      if (!supportsLocalRuntimeActions(providerId)) {
        setActionError(getUnsupportedProviderMessage(providerId))
        return
      }

      try {
        await deleteMutation.mutateAsync({
          providerId,
          modelId
        })
      } catch (error) {
        setActionError(getErrorMessage(error, 'Failed to delete local model.'))
      }
    },
    [deleteMutation]
  )

  return {
    actionError,
    isSelectionMutating: updatePreferencesMutation.isPending,
    selectModel,
    downloadModel,
    cancelDownload,
    deleteModel
  }
}
