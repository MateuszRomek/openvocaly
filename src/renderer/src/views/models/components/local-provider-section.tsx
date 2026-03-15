import type { JSX } from 'react'
import { AlertTriangleIcon, Clock3Icon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import type { TranscriptionProviderId } from '../hooks/use-transcription-provider-catalog'
import { Badge } from '@renderer/ui/badge'
import { LocalProviderSectionProvider } from '../contexts/local-provider-section-provider'
import type { LocalProviderSection as LocalProviderSectionData } from '../hooks/use-local-provider-settings'
import { LocalModelCard } from './local-model-card'

type LocalProviderSectionProps = {
  providerSection: LocalProviderSectionData
  isLastSection: boolean
}

const LOCAL_PROVIDER_DISPLAY_LABELS: Partial<Record<TranscriptionProviderId, string>> = {
  'local-parakeet': 'NVIDIA Parakeet',
  'local-whisper': 'Whisper'
}

export function LocalProviderSection({
  providerSection,
  isLastSection
}: LocalProviderSectionProps): JSX.Element {
  const { models, runtimeWarning, provider } = providerSection
  const isProviderAvailable = provider.availability === 'available'
  const providerLabel = LOCAL_PROVIDER_DISPLAY_LABELS[provider.id] ?? provider.label

  return (
    <section className={isLastSection ? '' : 'border-border border-b'}>
      <header className="bg-muted/30 border-border/70 flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold">{providerLabel}</h4>
          {!isProviderAvailable ? (
            <Badge variant="secondary" className="h-5 px-2 text-[11px]">
              <Clock3Icon className="size-3.5" />
              Coming soon
            </Badge>
          ) : null}
        </div>
      </header>

      {runtimeWarning ? (
        <div className="border-border/70 border-b px-5 py-4">
          <Alert variant="destructive">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
            <AlertTitle>Runtime unavailable</AlertTitle>
            <AlertDescription>{runtimeWarning}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <LocalProviderSectionProvider providerSection={providerSection}>
        {models.map((model, index) => (
          <LocalModelCard
            key={`${providerSection.provider.id}:${model.id}`}
            model={model}
            isLast={index === models.length - 1}
          />
        ))}
      </LocalProviderSectionProvider>
    </section>
  )
}
