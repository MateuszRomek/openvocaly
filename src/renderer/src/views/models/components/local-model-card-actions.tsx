import { useState, type JSX } from 'react'
import {
  CheckCircle2Icon,
  DownloadIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  Trash2Icon
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle
} from '@renderer/ui/alert-dialog'
import { Button } from '@renderer/ui/button'
import { Badge } from '@renderer/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/ui/dropdown-menu'
import { useLocalProviderSectionContext } from '../contexts/local-provider-section-context'
import type { LocalModelId } from '../types/local-models'

type LocalModelCardActionsProps = {
  modelId: LocalModelId
  isDownloaded: boolean
  isSelected: boolean
  isDownloading: boolean
}

export function LocalModelCardActions({
  modelId,
  isDownloaded,
  isSelected,
  isDownloading
}: LocalModelCardActionsProps): JSX.Element {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const section = useLocalProviderSectionContext()
  const isSelectionMutating = section.isSelectionMutating
  const isThisModelSelectionMutating = section.isSelectionMutatingModel(modelId)
  const supportsRuntimeActions = section.supportsRuntimeActions
  const isDownloadLockedByAnotherModel = section.isAnyDownloadActive && !isDownloading
  const hasDownloadError = section.hasModelDownloadError(modelId)

  const handleSelect = (): void => {
    section.selectModel(modelId)
  }

  const handleConfirmDelete = (): void => {
    setIsDeleteDialogOpen(false)
    void section.deleteModel(modelId)
  }

  const handleDownload = (): void => {
    if (isDownloadLockedByAnotherModel) {
      return
    }
    void section.downloadModel(modelId)
  }

  const handleCancel = (): void => {
    void section.cancelDownload()
  }

  if (!supportsRuntimeActions) {
    return <span className="text-muted-foreground text-xs">Available soon</span>
  }

  return (
    <>
      <div className="flex shrink-0 items-center justify-end gap-1.5 self-start md:self-center">
        {isSelected ? (
          <Badge
            variant="success"
            size="md"
            className="h-8 px-3 text-xs font-semibold"
            aria-label="Active transcription model"
          >
            <CheckCircle2Icon aria-hidden="true" />
            Active
          </Badge>
        ) : null}

        {isDownloaded && !isSelected ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSelectionMutating}
            aria-busy={isThisModelSelectionMutating}
            className={`min-w-24${
              isSelectionMutating && !isThisModelSelectionMutating ? ' disabled:opacity-100' : ''
            }`}
            onClick={handleSelect}
          >
            {isThisModelSelectionMutating ? (
              <Loader2Icon
                className="size-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : null}
            {isThisModelSelectionMutating ? 'Setting…' : 'Set active'}
          </Button>
        ) : null}

        {!isDownloaded && !isDownloading ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isDownloadLockedByAnotherModel}
            title={
              isDownloadLockedByAnotherModel
                ? 'Another model is downloading. Finish or cancel it first.'
                : undefined
            }
            onClick={handleDownload}
          >
            <DownloadIcon className="size-3.5" aria-hidden="true" />
            {hasDownloadError ? 'Retry' : 'Download'}
          </Button>
        ) : null}

        {isDownloading ? (
          <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
        ) : null}

        {isDownloaded ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 disabled:opacity-100"
                  aria-label={`More actions for ${modelId}`}
                  disabled={isSelectionMutating}
                />
              }
            >
              <MoreHorizontalIcon className="size-4" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" className="w-36">
              <DropdownMenuItem variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                <Trash2Icon className="size-4" aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2Icon aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete local model?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the local model files from this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="secondary">Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
              Delete model
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
