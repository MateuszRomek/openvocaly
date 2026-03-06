import { createContext, useContext, type JSX, type ReactNode } from 'react'
import type { TranscriptionProviderId } from '../hooks/use-transcription-provider-catalog'
import type { LocalModelDownloadProgress } from '../types/local-models'

export type LocalModelsControllerValue = {
  selectedModelId: string
  activeDownloadModelId: string | null
  downloadProgress: LocalModelDownloadProgress | null
  isSelectionMutating: boolean
  selectModel: (providerId: TranscriptionProviderId, modelId: string) => void
  downloadModel: (providerId: TranscriptionProviderId, modelId: string) => Promise<void>
  cancelDownload: (providerId: TranscriptionProviderId) => Promise<void>
  deleteModel: (providerId: TranscriptionProviderId, modelId: string) => Promise<void>
}

const LocalModelsControllerContext = createContext<LocalModelsControllerValue | null>(null)

type LocalModelsControllerProviderProps = {
  value: LocalModelsControllerValue
  children: ReactNode
}

export function LocalModelsControllerProvider({
  value,
  children
}: LocalModelsControllerProviderProps): JSX.Element {
  return (
    <LocalModelsControllerContext.Provider value={value}>
      {children}
    </LocalModelsControllerContext.Provider>
  )
}

export function useLocalModelsControllerContext(): LocalModelsControllerValue {
  const context = useContext(LocalModelsControllerContext)
  if (!context) {
    throw new Error(
      'useLocalModelsControllerContext must be used within LocalModelsControllerProvider.'
    )
  }

  return context
}
