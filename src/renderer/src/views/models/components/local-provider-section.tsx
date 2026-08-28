import type { JSX } from 'react'
import { AlertTriangleIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import type { TranscriptionProviderId } from '../hooks/use-transcription-provider-catalog'
import { LocalProviderSectionProvider } from '../contexts/local-provider-section-provider'
import type { LocalProviderSection as LocalProviderSectionData } from '../hooks/use-local-provider-settings'
import { LocalModelCard } from './local-model-card'

type LocalProviderSectionProps = {
  providerSection: LocalProviderSectionData
  isLastSection: boolean
}

const LOCAL_PROVIDER_DISPLAY_LABELS: Partial<Record<TranscriptionProviderId, string>> = {
  'local-parakeet': 'NVIDIA Parakeet',
  'local-whisper': 'Whisper',
  'local-qwen': 'Qwen3-ASR'
}

export function LocalProviderSection({
  providerSection,
  isLastSection
}: LocalProviderSectionProps): JSX.Element {
  const { models, runtimeWarning, provider } = providerSection
  const isProviderAvailable = provider.availability === 'available'
  const providerLabel = LOCAL_PROVIDER_DISPLAY_LABELS[provider.id] ?? provider.label
  const modelCountLabel = `${models.length} ${models.length === 1 ? 'model' : 'models'}`

  return (
    <section className={isLastSection ? '' : 'border-border border-b'}>
      <header className="border-border/70 flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-5 py-3">
        <div className="flex min-w-0 items-baseline gap-3">
          <h4 className="truncate text-sm font-semibold">{providerLabel}</h4>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {modelCountLabel}
          </span>
        </div>
        {!isProviderAvailable ? (
          <span className="text-muted-foreground text-xs">Available soon</span>
        ) : null}
      </header>

      {runtimeWarning ? (
        <div className="border-border/70 border-b px-5 py-3">
          <Alert variant="destructive">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
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
