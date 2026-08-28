import type { JSX } from 'react'
import { AlertTriangleIcon } from 'lucide-react'
import { SectionCard } from '@renderer/components/section-card'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import { LocalProviderSection } from './components/local-provider-section'
import { LocalModelsControllerProvider } from './contexts/local-models-controller-provider'
import { useLocalProviderSettings } from './hooks/use-local-provider-settings'
import { ModelsTranscriptionSkeleton } from './components/models-transcription-skeleton'

export function LocalModelsView(): JSX.Element {
  const {
    isLoading,
    requestError,
    selectedModelId,
    activeDownload,
    downloadProgress,
    isSelectionMutating,
    selectionMutationTarget,
    providerSections,
    selectModel,
    downloadModel,
    cancelDownload,
    deleteModel
  } = useLocalProviderSettings()

  return (
    <section className="space-y-4">
      {requestError ? (
        <Alert variant="destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <AlertTitle>Local model request failed</AlertTitle>
          <AlertDescription>{requestError}</AlertDescription>
        </Alert>
      ) : null}

      <LocalModelsControllerProvider
        value={{
          selectedModelId,
          activeDownload,
          downloadProgress,
          isSelectionMutating,
          selectionMutationTarget,
          selectModel,
          downloadModel,
          cancelDownload,
          deleteModel
        }}
      >
        {isLoading ? (
          <ModelsTranscriptionSkeleton />
        ) : (
          <SectionCard>
            {providerSections.map((providerSection, index) => (
              <LocalProviderSection
                key={providerSection.provider.id}
                providerSection={providerSection}
                isLastSection={index === providerSections.length - 1}
              />
            ))}
          </SectionCard>
        )}
      </LocalModelsControllerProvider>
    </section>
  )
}
