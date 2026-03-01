import { useCallback, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { buildAcceleratorFromKeyEvent } from '../helpers/shortcut-accelerator'
import { useResetShortcutMutation } from '../queries/shortcuts/use-reset-shortcut-mutation'
import { useShortcutsConfigQuery } from '../queries/shortcuts/use-shortcuts-config-query'
import { useShortcutsRuntimeStatusQuery } from '../queries/shortcuts/use-shortcuts-runtime-status-query'
import { useUpdateShortcutMutation } from '../queries/shortcuts/use-update-shortcut-mutation'
import type {
  ShortcutAction,
  ShortcutActionConfig,
  ShortcutConfigResponse,
  ShortcutErrorCode,
  ShortcutPlatform,
  ShortcutRuntimeStatusResponse
} from '../queries/shortcuts/shortcuts.types'

type UseShortcutsControllerArgs = {
  platform: ShortcutPlatform
}

type UseShortcutsControllerResult = {
  config: ShortcutConfigResponse | null
  isLoading: boolean
  requestError: string | null
  isMutating: boolean
  editingAction: ShortcutAction | null
  draftAccelerator: string
  draftErrorCode: ShortcutErrorCode | undefined
  runtimeStatus: ShortcutRuntimeStatusResponse | null
  beginEditing: (item: ShortcutActionConfig) => void
  cancelEditing: () => void
  captureKeyDown: (event: KeyboardEvent<HTMLButtonElement>, action: ShortcutAction) => void
  reset: (action: ShortcutAction) => void
}

export function useShortcuts({
  platform
}: UseShortcutsControllerArgs): UseShortcutsControllerResult {
  const shortcutsConfigQuery = useShortcutsConfigQuery()
  const shortcutsRuntimeStatusQuery = useShortcutsRuntimeStatusQuery()
  const updateShortcutMutation = useUpdateShortcutMutation()
  const resetShortcutMutation = useResetShortcutMutation()

  const [editingAction, setEditingAction] = useState<ShortcutAction | null>(null)
  const [draftAccelerator, setDraftAccelerator] = useState('')
  const [draftErrorCode, setDraftErrorCode] = useState<ShortcutErrorCode | undefined>()

  const config = shortcutsConfigQuery.data ?? null
  const runtimeStatus = shortcutsRuntimeStatusQuery.data ?? null
  const isLoading = shortcutsConfigQuery.isPending
  const isMutating = updateShortcutMutation.isPending || resetShortcutMutation.isPending

  const requestError = useMemo(() => {
    if (shortcutsConfigQuery.isError) {
      return 'Failed to load shortcut settings.'
    }

    if (shortcutsRuntimeStatusQuery.isError) {
      return 'Failed to load push-to-talk runtime status.'
    }

    if (updateShortcutMutation.isError) {
      return 'Failed to save shortcut. Please retry.'
    }

    if (resetShortcutMutation.isError) {
      return 'Failed to reset shortcut. Please retry.'
    }

    return null
  }, [
    resetShortcutMutation.isError,
    shortcutsConfigQuery.isError,
    shortcutsRuntimeStatusQuery.isError,
    updateShortcutMutation.isError
  ])

  const hasDuplicateDraft = useCallback(
    (action: ShortcutAction, accelerator: string): boolean => {
      if (!config) {
        return false
      }

      const normalizedAccelerator = accelerator.toLowerCase()

      return config.actions.some((candidate) => {
        if (candidate.action === action) {
          return false
        }

        return candidate.accelerator.toLowerCase() === normalizedAccelerator
      })
    },
    [config]
  )

  const beginEditing = useCallback(
    (item: ShortcutActionConfig): void => {
      if (!item.isSupportedGlobal || isMutating) {
        return
      }

      setEditingAction(item.action)
      setDraftAccelerator(item.accelerator)
      setDraftErrorCode(undefined)
    },
    [isMutating]
  )

  const cancelEditing = useCallback((): void => {
    setEditingAction(null)
    setDraftAccelerator('')
    setDraftErrorCode(undefined)
  }, [])

  const persistShortcut = useCallback(
    (action: ShortcutAction, accelerator: string): void => {
      if (hasDuplicateDraft(action, accelerator)) {
        setDraftErrorCode('duplicate_accelerator')
        return
      }

      updateShortcutMutation.mutate(
        {
          action,
          accelerator
        },
        {
          onSuccess: (response) => {
            if (!response.ok) {
              setDraftErrorCode(response.errorCode)
              return
            }

            cancelEditing()
          },
          onError: (error) => {
            console.error('Shortcut update failed', error)
          }
        }
      )
    },
    [cancelEditing, hasDuplicateDraft, updateShortcutMutation]
  )

  const captureKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, action: ShortcutAction): void => {
      event.preventDefault()
      event.stopPropagation()

      if (isMutating) {
        return
      }

      if (
        event.key === 'Escape' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        action !== 'recording.cancel'
      ) {
        cancelEditing()
        return
      }

      const accelerator = buildAcceleratorFromKeyEvent(event, platform)

      if (!accelerator) {
        setDraftErrorCode(undefined)
        return
      }

      setDraftAccelerator(accelerator)

      if (hasDuplicateDraft(action, accelerator)) {
        setDraftErrorCode('duplicate_accelerator')
        return
      }

      setDraftErrorCode(undefined)
      persistShortcut(action, accelerator)
    },
    [cancelEditing, hasDuplicateDraft, isMutating, persistShortcut, platform]
  )

  const resetAction = useCallback(
    (action: ShortcutAction): void => {
      resetShortcutMutation.mutate(
        { action },
        {
          onSuccess: (response) => {
            if (!response.ok) {
              return
            }

            if (editingAction === action) {
              cancelEditing()
            }
          },
          onError: (error) => {
            console.error('Shortcut reset failed', error)
          }
        }
      )
    },
    [cancelEditing, editingAction, resetShortcutMutation]
  )

  return {
    config,
    isLoading,
    requestError,
    isMutating,
    editingAction,
    draftAccelerator,
    draftErrorCode,
    runtimeStatus,
    beginEditing,
    cancelEditing,
    captureKeyDown,
    reset: resetAction
  }
}
