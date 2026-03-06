import type { JSX } from 'react'
import {
  CheckCircle2Icon,
  Clock3Icon,
  CpuIcon,
  MoreHorizontalIcon,
  Settings2Icon
} from 'lucide-react'
import { Badge } from '@renderer/ui/badge'
import { Button } from '@renderer/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/ui/dropdown-menu'
import { MODELS_COPY } from '../constants/copy'
import { useMediaQuery } from '../hooks/use-media-query'
import type {
  TranscriptionProviderId,
  TranscriptionProviderSettingsProvider
} from '../hooks/use-transcription-provider-catalog'

type TranscriptionProviderListItemProps = {
  provider: TranscriptionProviderSettingsProvider
  isSelected: boolean
  selectedModelId: string
  isSelectionMutating: boolean
  onSelect: (providerId: TranscriptionProviderId) => void
  onConfigure: (providerId: TranscriptionProviderId) => void
  isLast: boolean
}

export function TranscriptionProviderListItem({
  provider,
  isSelected,
  selectedModelId,
  isSelectionMutating,
  onSelect,
  onConfigure,
  isLast
}: TranscriptionProviderListItemProps): JSX.Element {
  const useCompactActions = useMediaQuery('(max-width: 830px)')
  const isAvailable = provider.availability === 'available'
  const isSelectable = isAvailable && provider.isConfigured
  const actionsCount = isAvailable ? 1 + (!isSelected && isSelectable ? 1 : 0) : 0
  const showOverflowMenu = useCompactActions && actionsCount > 1
  const configureButtonLabel = provider.isConfigured ? 'Edit provider' : 'Set up provider'

  const handleSelectProvider = (): void => {
    onSelect(provider.id)
  }

  const handleConfigureProvider = (): void => {
    onConfigure(provider.id)
  }

  return (
    <article className={`space-y-4 px-5 py-5 ${isLast ? '' : 'border-border border-b'}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
                Ready
              </Badge>
            ) : null}
          </div>

          <p className="text-muted-foreground text-sm">
            {isAvailable
              ? 'Use this provider to transcribe recordings.'
              : MODELS_COPY.providers.unavailableDescription}
          </p>
        </div>

        {isAvailable ? (
          <>
            {showOverflowMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button type="button" variant="outline" size="icon" className="size-8" />}
                  disabled={isSelectionMutating}
                >
                  <MoreHorizontalIcon className="size-4" />
                  <span className="sr-only">Provider actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom" className="w-44">
                  {!isSelected && isSelectable ? (
                    <DropdownMenuItem onClick={handleSelectProvider}>
                      <CheckCircle2Icon className="size-4" />
                      Set as active
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onClick={handleConfigureProvider}>
                    <Settings2Icon className="size-4" />
                    {configureButtonLabel}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2 self-center">
                {!isSelected && isSelectable ? (
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleSelectProvider}
                    disabled={isSelectionMutating}
                  >
                    Set as active
                  </Button>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleConfigureProvider}
                  disabled={isSelectionMutating}
                >
                  <Settings2Icon className="mr-1.5 size-4" />
                  {configureButtonLabel}
                </Button>
              </div>
            )}
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {provider.models.map((model) => {
          const isActiveModel = isSelected && model.id === selectedModelId
          const modelTitle = isActiveModel
            ? 'Currently active model for this provider.'
            : 'Available model for this provider.'

          return (
            <Badge
              key={model.id}
              variant={isActiveModel ? 'success' : 'outline'}
              className="h-auto rounded-md px-2 py-1 text-xs font-normal"
              title={modelTitle}
            >
              {isActiveModel ? (
                <CheckCircle2Icon className="size-3.5" />
              ) : (
                <CpuIcon className="size-3.5" />
              )}
              {model.label}
            </Badge>
          )
        })}
      </div>
    </article>
  )
}
