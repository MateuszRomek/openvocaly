import { createContext, useContext } from 'react'
import type { LocalModelDownloadProgress } from '../types/local-models'

export type LocalProviderSectionContextValue = {
  isSelectionMutating: boolean
  supportsRuntimeActions: boolean
  downloadProgress: LocalModelDownloadProgress | null
  isSelectedModel: (modelId: string) => boolean
  isModelDownloading: (modelId: string) => boolean
  selectModel: (modelId: string) => void
  downloadModel: (modelId: string) => Promise<void>
  cancelDownload: () => Promise<void>
  deleteModel: (modelId: string) => Promise<void>
}

export const LocalProviderSectionContext = createContext<LocalProviderSectionContextValue | null>(
  null
)

export function useLocalProviderSectionContext(): LocalProviderSectionContextValue {
  const context = useContext(LocalProviderSectionContext)
  if (!context) {
    throw new Error(
      'useLocalProviderSectionContext must be used within LocalProviderSectionProvider.'
    )
  }

  return context
}
