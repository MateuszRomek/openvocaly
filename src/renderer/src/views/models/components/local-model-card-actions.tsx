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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/ui/tooltip'
import { useLocalProviderSectionContext } from '../contexts/local-provider-section-context'
import { getLocalModelCardActionsCount } from '../helpers/local-model-card-actions'
import { useMediaQuery } from '../hooks/use-media-query'
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
  const compactActions = useMediaQuery('(max-width: 830px)')
  const isSelectionMutating = section.isSelectionMutating
  const supportsRuntimeActions = section.supportsRuntimeActions
  const isDownloadLockedByAnotherModel = section.isAnyDownloadActive && !isDownloading

  const actionsCount = getLocalModelCardActionsCount({
    isDownloaded,
    isSelected,
    isDownloading
  })
  const showOverflowMenu = supportsRuntimeActions && compactActions && actionsCount > 1

  const handleSelect = (): void => {
    section.selectModel(modelId)
  }

  const handleDelete = (): void => {
    setIsDeleteDialogOpen(true)
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
    return (
      <div className="self-center text-sm text-muted-foreground">
        Provider support is coming soon.
      </div>
    )
  }

  return (
    <>
      {showOverflowMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" variant="secondary" size="icon" className="size-8" />}
            disabled={isSelectionMutating}
          >
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">Model actions</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" className="w-44">
            {isDownloaded ? (
              <>
                {!isSelected ? (
                  <DropdownMenuItem onClick={handleSelect}>
                    <CheckCircle2Icon className="size-4" />
                    Set as active
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                  <Trash2Icon className="size-4" />
                  Delete
                </DropdownMenuItem>
              </>
            ) : (
              <>
                {!isDownloading ? (
                  <DropdownMenuItem
                    onClick={handleDownload}
                    disabled={isDownloadLockedByAnotherModel}
                  >
                    <DownloadIcon className="size-4" />
                    Download
                  </DropdownMenuItem>
                ) : null}
                {isDownloading ? (
                  <DropdownMenuItem onClick={handleCancel}>Cancel</DropdownMenuItem>
                ) : null}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : isDownloaded ? (
        <div className="flex items-center gap-2 self-center">
          {!isSelected ? (
            <Button
              type="button"
              variant="default"
              disabled={isSelectionMutating}
              onClick={handleSelect}
            >
              Set as active
            </Button>
          ) : null}
          <Button type="button" variant="destructive" onClick={handleDelete}>
            <Trash2Icon className="size-4" />
            <span>Delete</span>
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 self-center">
          {isDownloadLockedByAnotherModel ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    tabIndex={0}
                    role="button"
                    aria-disabled="true"
                    aria-label="Download unavailable while another model download is active"
                    className="inline-flex"
                  />
                }
              >
                <Button type="button" variant="secondary" disabled className="pointer-events-none">
                  <DownloadIcon className="mr-1.5 size-4" />
                  Download
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" align="center">
                Another model is downloading. Finish or cancel it first.
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              type="button"
              variant="secondary"
              disabled={isDownloading}
              onClick={handleDownload}
            >
              {isDownloading ? (
                <Loader2Icon className="mr-1.5 size-4 animate-spin" />
              ) : (
                <DownloadIcon className="mr-1.5 size-4" />
              )}
              Download
            </Button>
          )}
          {isDownloading ? (
            <Button type="button" variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2Icon />
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
