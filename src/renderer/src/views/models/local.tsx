import type { JSX } from 'react'
import { AlertTriangleIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import { LocalProviderSection } from './components/local-provider-section'
import { MODELS_COPY } from './constants/copy'
import { LocalModelsControllerProvider } from './contexts/local-models-controller-provider'
import { useLocalProviderSettings } from './hooks/use-local-provider-settings'

export function LocalModelsView(): JSX.Element {
  const {
    requestError,
    selectedModelId,
    activeDownloadModelId,
    downloadProgress,
    isSelectionMutating,
    providerSections,
    selectModel,
    downloadModel,
    cancelDownload,
    deleteModel
  } = useLocalProviderSettings()

  return (
    <section className="space-y-4">
      <header className="space-y-1.5">
        <h3 className="text-lg font-semibold">{MODELS_COPY.local.title}</h3>
        <p className="text-muted-foreground text-sm">{MODELS_COPY.local.description}</p>
      </header>

      {requestError ? (
        <Alert variant="destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <AlertTitle>Local model request failed</AlertTitle>
          <AlertDescription>{requestError}</AlertDescription>
        </Alert>
      ) : null}

      <LocalModelsControllerProvider
        value={{
          selectedModelId,
          activeDownloadModelId,
          downloadProgress,
          isSelectionMutating,
          selectModel,
          downloadModel,
          cancelDownload,
          deleteModel
        }}
      >
        {providerSections.map((providerSection) => (
          <LocalProviderSection
            key={providerSection.provider.id}
            providerSection={providerSection}
          />
        ))}
      </LocalModelsControllerProvider>
    </section>
  )
}
