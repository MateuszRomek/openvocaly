import { useState, type JSX } from 'react'
import { Loader2Icon, Trash2Icon } from 'lucide-react'
import { Button } from '@renderer/ui/button'
import { Field, FieldDescription, FieldLabel } from '@renderer/ui/field'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger
} from '@renderer/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/ui/tooltip'
import type { TranscriptionProviderSettingsProvider } from '../hooks/use-transcription-provider-catalog'

type TranscriptionProviderConfiguredApiKeyFieldProps = {
  provider: TranscriptionProviderSettingsProvider
  isApiKeyMutating: boolean
  isRemovingApiKey: boolean
  onRemoveApiKeyConfirm: () => void
}

export function TranscriptionProviderConfiguredApiKeyField({
  provider,
  isApiKeyMutating,
  isRemovingApiKey,
  onRemoveApiKeyConfirm
}: TranscriptionProviderConfiguredApiKeyFieldProps): JSX.Element {
  const [isDeletePopoverOpen, setIsDeletePopoverOpen] = useState(false)

  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>API key</FieldLabel>

        <Popover
          open={isDeletePopoverOpen}
          onOpenChange={(open) => {
            if (isRemovingApiKey) {
              return
            }
            setIsDeletePopoverOpen(open)
          }}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <Button type="button" variant="destructive" size="icon" className="size-8" />
                  }
                />
              }
              disabled={isApiKeyMutating || isRemovingApiKey}
            >
              <Trash2Icon className="size-4" />
              <span className="sr-only">Remove API key</span>
            </TooltipTrigger>
            <TooltipContent side="top" align="center">
              Remove API key
            </TooltipContent>
          </Tooltip>

          <PopoverContent align="end" side="bottom" className="w-72">
            <PopoverHeader>
              <PopoverTitle>Remove API key?</PopoverTitle>
              <PopoverDescription className="text-xs">
                {provider.label} will be unavailable until you add a new key.
              </PopoverDescription>
            </PopoverHeader>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isRemovingApiKey}
                onClick={() => {
                  setIsDeletePopoverOpen(false)
                }}
              >
                Keep key
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isRemovingApiKey}
                onClick={onRemoveApiKeyConfirm}
              >
                {isRemovingApiKey ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Removing key...
                  </>
                ) : (
                  'Remove API key'
                )}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <div className="border-border/70 bg-muted/20 text-foreground flex h-8 items-center rounded-lg border px-2.5 text-sm">
          <span className="font-medium tracking-wide">{provider.apiKeyPreview ?? '••••'}</span>
        </div>

        <FieldDescription>Stored securely on this device only.</FieldDescription>
      </div>
    </Field>
  )
}
