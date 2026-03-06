import type { JSX } from 'react'
import { AlertTriangleIcon } from 'lucide-react'
import { SectionCard } from '@renderer/components/section-card'
import { Badge } from '@renderer/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import { LocalProviderSectionProvider } from '../contexts/local-provider-section-context'
import type { LocalProviderSection as LocalProviderSectionData } from '../hooks/use-local-provider-settings'
import { LocalModelCard } from './local-model-card'

type LocalProviderSectionProps = {
  providerSection: LocalProviderSectionData
}

export function LocalProviderSection({ providerSection }: LocalProviderSectionProps): JSX.Element {
  const { provider, isSelected, models, runtimeWarning } = providerSection

  return (
    <section className="space-y-3">
      <header className="flex items-center gap-2">
        <h4 className="text-base font-semibold">{provider.label}</h4>
        {provider.availability !== 'available' ? <Badge variant="outline">Coming soon</Badge> : null}
        {isSelected ? <Badge variant="success">Active provider</Badge> : null}
      </header>

      {runtimeWarning ? (
        <Alert variant="destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <AlertTitle>Runtime unavailable</AlertTitle>
          <AlertDescription>{runtimeWarning}</AlertDescription>
        </Alert>
      ) : null}

      <LocalProviderSectionProvider providerSection={providerSection}>
        <SectionCard>
          {models.map((model, index) => (
            <LocalModelCard key={`${provider.id}:${model.id}`} model={model} isLast={index === models.length - 1} />
          ))}
        </SectionCard>
      </LocalProviderSectionProvider>
    </section>
  )
}
