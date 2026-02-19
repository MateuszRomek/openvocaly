import { useCallback } from 'react'
import type { KeyboardEvent } from 'react'
import {
  ACTION_META,
  SHORTCUT_ROW_ACTIVE_CAPTURE_CLASS,
  SHORTCUT_ROW_DISABLED_SURFACE_CLASS,
  SHORTCUT_ROW_INTERACTIVE_SURFACE_CLASS,
  UNSUPPORTED_GLOBAL_MESSAGE
} from '../constants'
import { toErrorMessage } from '../helpers/shortcut-accelerator'
import type { ShortcutActionConfig } from '../queries/shortcuts/shortcuts.types'
import type { ShortcutRowController } from './use-shortcut-settings'

type UseShortcutRowArgs = {
  item: ShortcutActionConfig
  index: number
  total: number
  rowController: ShortcutRowController
}

type UseShortcutRowResult = {
  isLast: boolean
  meta: (typeof ACTION_META)[keyof typeof ACTION_META]
  isEditingThisRow: boolean
  isMutating: boolean
  surfaceClass: string
  activeCaptureClass: string
  displayedAccelerator: string
  runtimeError: string | null
  draftError: string | null
  unsupportedMessage: string | null
  onBeginEditing: () => void
  onCaptureKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  onBlur: () => void
  onReset: () => void
}

export const useShortcutRow = ({
  item,
  index,
  total,
  rowController
}: UseShortcutRowArgs): UseShortcutRowResult => {
  const isSupportedGlobal = item.isSupportedGlobal
  const isLast = index === total - 1
  const isMutating = rowController.isMutating
  const isEditingThisRow = rowController.editingAction === item.action && isSupportedGlobal

  const surfaceClass = isSupportedGlobal
    ? SHORTCUT_ROW_INTERACTIVE_SURFACE_CLASS
    : SHORTCUT_ROW_DISABLED_SURFACE_CLASS

  const activeCaptureClass = isEditingThisRow ? SHORTCUT_ROW_ACTIVE_CAPTURE_CLASS : ''

  const runtimeError = toErrorMessage(item.registrationError)
  const draftError = isEditingThisRow ? toErrorMessage(rowController.draftErrorCode) : null
  const unsupportedMessage = isSupportedGlobal ? null : UNSUPPORTED_GLOBAL_MESSAGE
  const displayedAccelerator = isEditingThisRow ? rowController.draftAccelerator : item.accelerator

  const onBeginEditing = useCallback((): void => {
    rowController.beginEditing(item)
  }, [item, rowController])

  const onCaptureKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>): void => {
      if (!isEditingThisRow) {
        return
      }

      rowController.captureKeyDown(event, item.action)
    },
    [isEditingThisRow, item.action, rowController]
  )

  const onBlur = useCallback((): void => {
    if (isEditingThisRow && !isMutating) {
      rowController.cancelEditing()
    }
  }, [isEditingThisRow, isMutating, rowController])

  const onReset = useCallback((): void => {
    void rowController.reset(item.action)
  }, [item.action, rowController])

  return {
    isLast,
    meta: ACTION_META[item.action],
    isEditingThisRow,
    isMutating,
    surfaceClass,
    activeCaptureClass,
    displayedAccelerator,
    runtimeError,
    draftError,
    unsupportedMessage,
    onBeginEditing,
    onCaptureKeyDown,
    onBlur,
    onReset
  }
}
