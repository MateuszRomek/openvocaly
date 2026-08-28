import { useMemo, useState } from 'react'
import { AlertCircleIcon, CpuIcon } from 'lucide-react'
import {
  getDownloadedMeetingModels,
  type DownloadedMeetingModel,
  type MeetingImportSelection
} from '../../../../../shared/meetings'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import { Button } from '@renderer/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/ui/dialog'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from '@renderer/ui/select'
import { Spinner } from '@renderer/ui/spinner'
import { useTranscriptionPreferencesQuery } from '@renderer/queries/transcription/use-transcription-preferences-query'

type MeetingImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (selection: MeetingImportSelection) => void
}

const toModelKey = (model: Pick<DownloadedMeetingModel, 'providerId' | 'modelId'>): string =>
  `${model.providerId}:${model.modelId}`

const toSelection = (model: DownloadedMeetingModel): MeetingImportSelection => ({
  providerId: model.providerId,
  modelId: model.modelId
})

export function MeetingImportDialog({
  open,
  onOpenChange,
  onSubmit
}: MeetingImportDialogProps): React.JSX.Element {
  const preferencesQuery = useTranscriptionPreferencesQuery()
  const [selectedModelKey, setSelectedModelKey] = useState('')

  const availableModels = useMemo(
    () => (preferencesQuery.data ? getDownloadedMeetingModels(preferencesQuery.data.config) : []),
    [preferencesQuery.data]
  )
  const preferredModel = preferencesQuery.data
    ? availableModels.find(
        (model) =>
          model.providerId === preferencesQuery.data.preferences.providerId &&
          model.modelId === preferencesQuery.data.preferences.modelId
      )
    : undefined

  const defaultModel = preferredModel ?? availableModels[0]
  const effectiveSelectedModelKey = availableModels.some(
    (model) => toModelKey(model) === selectedModelKey
  )
    ? selectedModelKey
    : defaultModel
      ? toModelKey(defaultModel)
      : ''
  const selectedModel = availableModels.find(
    (model) => toModelKey(model) === effectiveSelectedModelKey
  )
  const canSubmit = Boolean(selectedModel) && !preferencesQuery.isPending

  const handleSubmit = (): void => {
    if (!selectedModel) {
      return
    }

    onOpenChange(false)
    onSubmit(toSelection(selectedModel))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose a model</DialogTitle>
          <DialogDescription>
            Select a downloaded local model. You’ll choose the recording next.
          </DialogDescription>
        </DialogHeader>

        {preferencesQuery.isPending ? (
          <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
            <Spinner aria-hidden="true" />
            Loading downloaded models…
          </div>
        ) : preferencesQuery.isError ? (
          <Alert variant="destructive">
            <AlertCircleIcon aria-hidden="true" />
            <AlertTitle>Could not load local models</AlertTitle>
            <AlertDescription>
              Open Models and make sure a local model is installed.
            </AlertDescription>
          </Alert>
        ) : availableModels.length === 0 ? (
          <Alert>
            <CpuIcon aria-hidden="true" />
            <AlertTitle>No downloaded model</AlertTitle>
            <AlertDescription>
              Download a local transcription model in Models before importing a recording.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            <label htmlFor="meeting-transcription-model" className="text-sm font-medium">
              Transcription model
            </label>
            <Select
              value={effectiveSelectedModelKey}
              onValueChange={(value) => setSelectedModelKey(value ?? '')}
            >
              <SelectTrigger id="meeting-transcription-model" className="w-full">
                <span className={selectedModel ? '' : 'text-muted-foreground'}>
                  {selectedModel?.label ?? 'Choose a downloaded model'}
                </span>
              </SelectTrigger>
              <SelectContent align="start" className="min-w-[18rem]">
                <SelectGroup>
                  {availableModels.map((model) => (
                    <SelectItem key={toModelKey(model)} value={toModelKey(model)}>
                      <span className="min-w-0">
                        <span className="block truncate">{model.label}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {model.providerLabel}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {selectedModel ? (
              <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-3">
                <span className="bg-background text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <CpuIcon aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{selectedModel.label}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {selectedModel.providerLabel}
                    {selectedModel.language ? ` · ${selectedModel.language}` : ''}
                  </p>
                  {selectedModel.description ? (
                    <p className="text-muted-foreground mt-2 text-xs text-pretty">
                      {selectedModel.description}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            <CpuIcon aria-hidden="true" />
            Choose file
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
