import { CheckCircle2Icon, Clock3Icon, Settings2Icon } from 'lucide-react'
import { Badge } from '@renderer/ui/badge'
import { Button } from '@renderer/ui/button'
import type {
  TranscriptionProviderId,
  TranscriptionProviderSettingsProvider
} from '../hooks/use-transcription-provider-catalog'

type TranscriptionProviderListItemProps = {
  provider: TranscriptionProviderSettingsProvider
  isSelected: boolean
  isSelectionMutating: boolean
  onSelect: (providerId: TranscriptionProviderId) => void
  onConfigure: (providerId: TranscriptionProviderId) => void
  isLast: boolean
}

export function TranscriptionProviderListItem({
  provider,
  isSelected,
  isSelectionMutating,
  onSelect,
  onConfigure,
  isLast
}: TranscriptionProviderListItemProps): React.JSX.Element {
  const isAvailable = provider.availability === 'available'
  const isSelectable = isAvailable && provider.isConfigured

  return (
    <article className={`space-y-4 px-5 py-5 ${isLast ? '' : 'border-border border-b'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold">{provider.label}</h4>

            {isAvailable && isSelected ? (
              <Badge variant="success" className="h-5 px-2 text-[11px] font-semibold">
                <CheckCircle2Icon className="size-3.5" />
                Active
              </Badge>
            ) : null}

            {!isAvailable ? (
              <Badge variant="secondary" className="h-5 px-2 text-[11px]">
                <Clock3Icon className="size-3.5" />
                Coming soon
              </Badge>
            ) : null}

            {isAvailable && provider.isConfigured ? (
              <Badge variant="outline" className="h-5 px-2 text-[11px]">
                Configured
              </Badge>
            ) : null}
          </div>

          <p className="text-muted-foreground text-sm">
            {isAvailable
              ? 'Use this provider for recording transcription.'
              : 'UI preview only. Provider integration will be added in a future PR.'}
          </p>
        </div>

        {isAvailable ? (
          <div className="flex items-center gap-2 self-center">
            {!isSelected && isSelectable ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onSelect(provider.id)
                }}
                disabled={isSelectionMutating}
              >
                Select
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onConfigure(provider.id)
              }}
              disabled={isSelectionMutating}
            >
              <Settings2Icon className="mr-1.5 size-4" />
              Configure
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {provider.models.map((model) => (
          <Badge
            key={model.id}
            variant="outline"
            className="h-auto rounded-md px-2 py-1 text-xs font-normal"
          >
            {model.label}
          </Badge>
        ))}
      </div>
    </article>
  )
}
