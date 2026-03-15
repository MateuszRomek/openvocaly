import { createContext, useContext } from 'react'
import type { TranscriptionProviderId } from '../hooks/use-transcription-provider-catalog'
import type { LocalModelDownloadProgress } from '../types/local-models'

export type LocalModelsControllerValue = {
  selectedModelId: string
  activeDownload: {
    providerId: LocalModelDownloadProgress['providerId']
    modelId: LocalModelDownloadProgress['modelId']
  } | null
  downloadProgress: LocalModelDownloadProgress | null
  isSelectionMutating: boolean
  selectModel: (providerId: TranscriptionProviderId, modelId: string) => void
  downloadModel: (providerId: TranscriptionProviderId, modelId: string) => Promise<void>
  cancelDownload: (providerId: TranscriptionProviderId) => Promise<void>
  deleteModel: (providerId: TranscriptionProviderId, modelId: string) => Promise<void>
}

export const LocalModelsControllerContext = createContext<LocalModelsControllerValue | null>(null)

export function useLocalModelsControllerContext(): LocalModelsControllerValue {
  const context = useContext(LocalModelsControllerContext)
  if (!context) {
    throw new Error(
      'useLocalModelsControllerContext must be used within LocalModelsControllerProvider.'
    )
  }

  return context
}
