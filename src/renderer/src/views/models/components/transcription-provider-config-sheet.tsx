import type { JSX } from 'react'
import { AlertTriangleIcon, KeyRoundIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import { Button } from '@renderer/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@renderer/ui/sheet'
import { toast } from 'sonner'
import { MODELS_COPY } from '../constants/copy'
import { useClearTranscriptionProviderApiKey } from '../hooks/use-clear-transcription-provider-api-key'
import { useTranscriptionProviderConfigSheet } from '../hooks/use-transcription-provider-config-sheet'
import { useSaveTranscriptionProviderApiKey } from '../hooks/use-save-transcription-provider-api-key'
import { useTranscriptionProviderSelectionActions } from '../hooks/use-transcription-provider-selection-actions'
import type { TranscriptionProviderId } from '../hooks/use-transcription-provider-catalog'
import { TranscriptionProviderConfiguredApiKeyField } from './transcription-provider-configured-api-key-field'
import { TranscriptionProviderDraftApiKeyField } from './transcription-provider-draft-api-key-field'

type TranscriptionProviderConfigSheetProps = {
  providerId: TranscriptionProviderId | null
  onOpenChange: (open: boolean) => void
}

export function TranscriptionProviderConfigSheet({
  providerId,
  onOpenChange
}: TranscriptionProviderConfigSheetProps): JSX.Element {
  const {
    providers,
    provider,
    secureStorageAvailable,
    sheetModelValue,
    sheetApiKeyDraft,
    hasDraftApiKey,
    isDraftApiKeyVisible,
    canSaveSheetApiKey,
    setApiKeyDraft,
    resetApiKeyDraft,
    toggleApiKeyVisibility
  } = useTranscriptionProviderConfigSheet(providerId)

  const selectionActions = useTranscriptionProviderSelectionActions(providers)
  const clearProviderApiKey = useClearTranscriptionProviderApiKey()
  const saveProviderApiKey = useSaveTranscriptionProviderApiKey()

  const isSelectionMutating = selectionActions.isMutating
  const isRemovingApiKey = clearProviderApiKey.isPending
  const isApiKeyMutating = clearProviderApiKey.isPending || saveProviderApiKey.isPending
  const canSaveChanges = canSaveSheetApiKey && !isApiKeyMutating

  const handleModelChange = (value: string | null): void => {
    if (!provider || !value || value.length === 0) {
      return
    }

    selectionActions.setModel(provider.id, value)
  }

  const handleRemoveApiKeyConfirm = (): void => {
    if (!provider) {
      return
    }

    void (async (): Promise<void> => {
      try {
        const result = await clearProviderApiKey.clear(provider.id)
        if (!result.ok) {
          toast.error(MODELS_COPY.errors.removeApiKey)
          return
        }

        resetApiKeyDraft()
        toast.success('API key removed.')
      } catch {
        toast.error(MODELS_COPY.errors.removeApiKey)
      }
    })()
  }

  const handleSaveChanges = (): void => {
    if (!provider) {
      return
    }

    void (async (): Promise<void> => {
      try {
        const result = await saveProviderApiKey.save(provider.id, sheetApiKeyDraft)
        if (!result.ok) {
          toast.error(MODELS_COPY.errors.saveApiKey)
          return
        }

        resetApiKeyDraft()
        toast.success('API key saved.')
        onOpenChange(false)
      } catch {
        toast.error(MODELS_COPY.errors.saveApiKey)
      }
    })()
  }

  return (
    <Sheet open={provider !== null} onOpenChange={onOpenChange}>
      {provider ? (
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{provider.label} settings</SheetTitle>
            <SheetDescription>Choose a model and manage your API key.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="space-y-4 px-4 pb-4">
              {!secureStorageAvailable ? (
                <Alert variant="destructive">
                  <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                  <AlertTitle>Cannot store API keys securely</AlertTitle>
                  <AlertDescription>This device can&apos;t securely store API keys.</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-1.5">
                <label className="text-sm leading-none font-medium">Model</label>
                <Select
                  value={sheetModelValue}
                  onValueChange={handleModelChange}
                  disabled={isSelectionMutating || provider.models.length <= 1}
                >
                  <SelectTrigger className="w-full" aria-label={`${provider.label} model`}>
                    <SelectValue placeholder="Choose model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {provider.models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {provider.isConfigured ? (
                <TranscriptionProviderConfiguredApiKeyField
                  provider={provider}
                  isApiKeyMutating={isApiKeyMutating}
                  isRemovingApiKey={isRemovingApiKey}
                  onRemoveApiKeyConfirm={handleRemoveApiKeyConfirm}
                />
              ) : (
                <TranscriptionProviderDraftApiKeyField
                  provider={provider}
                  secureStorageAvailable={secureStorageAvailable}
                  isApiKeyMutating={isApiKeyMutating}
                  sheetApiKeyDraft={sheetApiKeyDraft}
                  hasDraftApiKey={hasDraftApiKey}
                  isDraftApiKeyVisible={isDraftApiKeyVisible}
                  onApiKeyDraftChange={setApiKeyDraft}
                  onToggleApiKeyVisibility={toggleApiKeyVisibility}
                />
              )}

              {!provider.isConfigured ? (
                <Alert>
                  <KeyRoundIcon className="mt-0.5 size-4 shrink-0" />
                  <AlertTitle>API key required</AlertTitle>
                  <AlertDescription>
                    Add an API key to use this provider for transcription.
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          </div>

          <SheetFooter className="border-border/60 border-t bg-background p-4">
            {!provider.isConfigured ? (
              <Button
                type="button"
                className="w-full"
                onClick={handleSaveChanges}
                disabled={!canSaveChanges}
              >
                {saveProviderApiKey.isPending ? 'Saving...' : 'Save API key'}
              </Button>
            ) : null}
            <SheetClose render={<Button type="button" variant="outline" className="w-full" />}>
              Close panel
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      ) : null}
    </Sheet>
  )
}
