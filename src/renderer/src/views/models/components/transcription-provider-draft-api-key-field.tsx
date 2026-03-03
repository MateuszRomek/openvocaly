import type { JSX } from 'react'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { Field, FieldDescription, FieldLabel } from '@renderer/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '@renderer/ui/input-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/ui/tooltip'
import type { TranscriptionProviderSettingsProvider } from '../hooks/use-transcription-provider-catalog'

type TranscriptionProviderDraftApiKeyFieldProps = {
  provider: TranscriptionProviderSettingsProvider
  secureStorageAvailable: boolean
  isApiKeyMutating: boolean
  sheetApiKeyDraft: string
  hasDraftApiKey: boolean
  isDraftApiKeyVisible: boolean
  onApiKeyDraftChange: (value: string) => void
  onToggleApiKeyVisibility: () => void
}

export function TranscriptionProviderDraftApiKeyField({
  provider,
  secureStorageAvailable,
  isApiKeyMutating,
  sheetApiKeyDraft,
  hasDraftApiKey,
  isDraftApiKeyVisible,
  onApiKeyDraftChange,
  onToggleApiKeyVisibility
}: TranscriptionProviderDraftApiKeyFieldProps): JSX.Element {
  return (
    <Field>
      <FieldLabel htmlFor={`transcription-api-key-${provider.id}`}>API key</FieldLabel>

      <div className="space-y-2">
        <InputGroup>
          <InputGroupInput
            id={`transcription-api-key-${provider.id}`}
            type={hasDraftApiKey && isDraftApiKeyVisible ? 'text' : 'password'}
            autoComplete="off"
            placeholder={`Enter ${provider.label} API key`}
            value={sheetApiKeyDraft}
            onChange={(event) => {
              onApiKeyDraftChange(event.target.value)
            }}
            disabled={!secureStorageAvailable || isApiKeyMutating}
            className="w-full"
          />
          {hasDraftApiKey ? (
            <InputGroupAddon align="inline-end">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <InputGroupButton
                      variant="ghost"
                      size="icon-xs"
                      aria-label={
                        isDraftApiKeyVisible ? 'Hide API key draft' : 'Show API key draft'
                      }
                    />
                  }
                  onClick={onToggleApiKeyVisibility}
                >
                  {isDraftApiKeyVisible ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </TooltipTrigger>
                <TooltipContent side="top" align="center">
                  {isDraftApiKeyVisible ? 'Hide API key' : 'Show API key'}
                </TooltipContent>
              </Tooltip>
            </InputGroupAddon>
          ) : null}
        </InputGroup>

        <FieldDescription>API key is stored securely on this device only.</FieldDescription>
      </div>
    </Field>
  )
}
