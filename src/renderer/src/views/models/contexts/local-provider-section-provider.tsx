import { useCallback, useMemo, type JSX, type ReactNode } from 'react'
import type { LocalProviderSection } from '../hooks/use-local-provider-settings'
import { useLocalModelsControllerContext } from './local-models-controller-context'
import {
  LocalProviderSectionContext,
  type LocalProviderSectionContextValue
} from './local-provider-section-context'

type LocalProviderSectionProviderProps = {
  providerSection: LocalProviderSection
  children: ReactNode
}

export function LocalProviderSectionProvider({
  providerSection,
  children
}: LocalProviderSectionProviderProps): JSX.Element {
  const controller = useLocalModelsControllerContext()
  const providerId = providerSection.provider.id
  const isProviderSelected = providerSection.isSelected

  const isSelectedModel = useCallback(
    (modelId: string): boolean => isProviderSelected && controller.selectedModelId === modelId,
    [controller.selectedModelId, isProviderSelected]
  )

  const isModelDownloading = useCallback(
    (modelId: string): boolean => controller.activeDownloadModelId === modelId,
    [controller.activeDownloadModelId]
  )

  const selectModel = useCallback(
    (modelId: string): void => {
      controller.selectModel(providerId, modelId)
    },
    [controller, providerId]
  )

  const downloadModel = useCallback(
    async (modelId: string): Promise<void> => {
      await controller.downloadModel(providerId, modelId)
    },
    [controller, providerId]
  )

  const cancelDownload = useCallback(async (): Promise<void> => {
    await controller.cancelDownload(providerId)
  }, [controller, providerId])

  const deleteModel = useCallback(
    async (modelId: string): Promise<void> => {
      await controller.deleteModel(providerId, modelId)
    },
    [controller, providerId]
  )

  const contextValue = useMemo<LocalProviderSectionContextValue>(
    () => ({
      isSelectionMutating: controller.isSelectionMutating,
      supportsRuntimeActions: providerSection.supportsRuntimeActions,
      downloadProgress: controller.downloadProgress,
      isSelectedModel,
      isModelDownloading,
      selectModel,
      downloadModel,
      cancelDownload,
      deleteModel
    }),
    [
      cancelDownload,
      controller.downloadProgress,
      controller.isSelectionMutating,
      deleteModel,
      downloadModel,
      isModelDownloading,
      isSelectedModel,
      providerSection.supportsRuntimeActions,
      selectModel
    ]
  )

  return (
    <LocalProviderSectionContext.Provider value={contextValue}>
      {children}
    </LocalProviderSectionContext.Provider>
  )
}
