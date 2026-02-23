import { useCallback } from 'react'
import type { KeyboardEvent } from 'react'
import {
  PTT_STATUS_BADGE,
  PTT_STATUS_MESSAGE,
  SHORTCUT_ACTION_META,
  SHORTCUT_ROW_ACTIVE_CAPTURE_CLASS,
  SHORTCUT_ROW_DISABLED_SURFACE_CLASS,
  SHORTCUT_ROW_INTERACTIVE_SURFACE_CLASS,
  SHORTCUT_UNSUPPORTED_GLOBAL_MESSAGE
} from '../constants/shortcuts'
import { toErrorMessage } from '../helpers/shortcut-accelerator'
import type {
  ShortcutAction,
  ShortcutActionConfig,
  ShortcutErrorCode,
  ShortcutPttAvailability,
  ShortcutRuntimeStatusResponse
} from '../queries/shortcuts/shortcuts.types'
type UseShortcutRowArgs = {
  item: ShortcutActionConfig
  index: number
  total: number
  rowController: {
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
}

type UseShortcutRowResult = {
  isLast: boolean
  meta: (typeof SHORTCUT_ACTION_META)[keyof typeof SHORTCUT_ACTION_META]
  canEdit: boolean
  isEditingThisRow: boolean
  isMutating: boolean
  surfaceClass: string
  activeCaptureClass: string
  displayedAccelerator: string
  statusBadge: { label: string; variant: 'secondary' | 'outline' | 'destructive' } | null
  statusMessage: string | null
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
  const isPushToTalk = item.action === 'recording.push_to_talk'
  const runtimeStatus = rowController.runtimeStatus
  const pttAvailability: ShortcutPttAvailability =
    runtimeStatus?.ptt.availability ?? 'unsupported_platform'

  const statusBadge = isPushToTalk
    ? pttAvailability === 'ready'
      ? null
      : PTT_STATUS_BADGE[pttAvailability]
    : null

  const statusMessage = isPushToTalk
    ? pttAvailability === 'ready'
      ? null
      : (runtimeStatus?.ptt.message ?? PTT_STATUS_MESSAGE[pttAvailability])
    : null

  const canEdit = isSupportedGlobal
  const isMutating = rowController.isMutating
  const isEditingThisRow = rowController.editingAction === item.action && canEdit

  const surfaceClass = isSupportedGlobal
    ? SHORTCUT_ROW_INTERACTIVE_SURFACE_CLASS
    : SHORTCUT_ROW_DISABLED_SURFACE_CLASS

  const activeCaptureClass = isEditingThisRow ? SHORTCUT_ROW_ACTIVE_CAPTURE_CLASS : ''

  const runtimeError = toErrorMessage(item.registrationError)
  const draftError = isEditingThisRow ? toErrorMessage(rowController.draftErrorCode) : null
  const unsupportedMessage = isPushToTalk
    ? statusMessage
    : isSupportedGlobal
      ? null
      : SHORTCUT_UNSUPPORTED_GLOBAL_MESSAGE
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
    meta: SHORTCUT_ACTION_META[item.action],
    canEdit,
    isEditingThisRow,
    isMutating,
    surfaceClass,
    activeCaptureClass,
    displayedAccelerator,
    statusBadge,
    statusMessage,
    runtimeError,
    draftError,
    unsupportedMessage,
    onBeginEditing,
    onCaptureKeyDown,
    onBlur,
    onReset
  }
}
