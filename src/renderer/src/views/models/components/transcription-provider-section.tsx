import { useState, type JSX } from 'react'
import { AlertTriangleIcon } from 'lucide-react'
import { SectionCard } from '@renderer/components/section-card'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import { useTranscriptionProviderSettings } from '../hooks/use-transcription-provider-settings'
import type { TranscriptionProviderId } from '../hooks/use-transcription-provider-catalog'
import { ModelsTranscriptionSkeleton } from './models-transcription-skeleton'
import { TranscriptionProviderConfigSheet } from './transcription-provider-config-sheet'
import { TranscriptionProviderListItem } from './transcription-provider-list-item'

export function TranscriptionProviderSection(): JSX.Element {
  const [configureProviderId, setConfigureProviderId] = useState<TranscriptionProviderId | null>(
    null
  )

  const {
    isLoading,
    requestError,
    providers,
    selectedProviderId,
    selectedModelId,
    isSelectionMutating,
    setProvider
  } = useTranscriptionProviderSettings()

  const openConfigureSheet = (providerId: TranscriptionProviderId): void => {
    const provider = providers.find((candidate) => candidate.id === providerId)
    if (!provider || provider.availability !== 'available') {
      return
    }

    setConfigureProviderId(providerId)
  }

  if (isLoading) {
    return <ModelsTranscriptionSkeleton />
  }

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">Cloud providers</h3>
      <p className="text-muted-foreground text-sm">Choose a provider and configure access.</p>

      {requestError ? (
        <Alert variant="destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <AlertTitle>Could not update transcription settings</AlertTitle>
          <AlertDescription>{requestError}</AlertDescription>
        </Alert>
      ) : null}

      <SectionCard>
        {providers.map((provider, index) => (
          <TranscriptionProviderListItem
            key={provider.id}
            provider={provider}
            isSelected={provider.id === selectedProviderId}
            selectedModelId={selectedModelId}
            isSelectionMutating={isSelectionMutating}
            isLast={index === providers.length - 1}
            onSelect={(providerId) => {
              setProvider(providerId)
            }}
            onConfigure={openConfigureSheet}
          />
        ))}
      </SectionCard>

      <TranscriptionProviderConfigSheet
        key={configureProviderId ?? 'none'}
        providerId={configureProviderId}
        onOpenChange={(open) => {
          if (!open) {
            setConfigureProviderId(null)
          }
        }}
      />
    </section>
  )
}
