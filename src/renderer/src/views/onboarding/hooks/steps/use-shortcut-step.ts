import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ShortcutMutationResponse } from '../../../../../../shared/shortcuts'
import type { ShortcutCaptureKeyEvent } from '../../helpers/shortcut-accelerator'
import { buildAcceleratorFromKeyEvent } from '../../helpers/shortcut-accelerator'
import { onboardingShortcutsKeys } from '../../queries/shortcuts/onboarding-shortcuts.keys'
import { useOnboardingUpdateShortcutMutation } from '../../queries/shortcuts/use-onboarding-update-shortcut-mutation'
import { useShortcutDisplay } from '../shared/use-shortcut-display'

type ShortcutErrorCode = NonNullable<ShortcutMutationResponse['errorCode']>

type ShortcutSaveState = {
  isCapturing: boolean
  draft: string
  error: string | null
}

export type UseShortcutStepResult = {
  accelerator: string
  display: string
  isCapturing: boolean
  draft: string
  error: string | null
  idleHint: string
  recordingHint: string
  startShortcutCapture: () => void
  stopShortcutCapture: () => void
  onShortcutCaptureKeyDown: (event: ShortcutCaptureKeyEvent) => void
}

const SHORTCUT_CAPTURE_ERROR_BY_CODE: Partial<Record<ShortcutErrorCode, string>> = {
  duplicate_accelerator: 'This shortcut is already used by another action.',
  invalid_accelerator: 'This shortcut is not valid.',
  registration_conflict: 'This shortcut conflicts with another app or system shortcut.',
  registration_failed: 'Shortcut registration failed. Try another combination.'
}

export function useShortcutStep(): UseShortcutStepResult {
  const queryClient = useQueryClient()
  const platform = window.api.system.platform
  const shortcutDisplay = useShortcutDisplay()
  const updateShortcutMutation = useOnboardingUpdateShortcutMutation()
  const [shortcutSaveState, setShortcutSaveState] = useState<ShortcutSaveState>({
    isCapturing: false,
    draft: '',
    error: null
  })

  const setShortcutCaptureSessionActive = useCallback((active: boolean): void => {
    if (active) {
      void window.api.shortcuts.startCaptureSession().catch(() => undefined)
      return
    }

    void window.api.shortcuts.stopCaptureSession().catch(() => undefined)
  }, [])

  useEffect(() => {
    return () => {
      void window.api.shortcuts.stopCaptureSession().catch(() => undefined)
    }
  }, [])

  const currentShortcut = shortcutDisplay.accelerator
  const currentShortcutDisplay = shortcutDisplay.display

  const persistShortcut = useCallback(
    async (accelerator: string): Promise<void> => {
      const response = await updateShortcutMutation.mutateAsync({
        action: 'recording.toggle',
        accelerator
      })

      if (!response.ok) {
        const message = response.errorCode
          ? (SHORTCUT_CAPTURE_ERROR_BY_CODE[response.errorCode] ?? 'Shortcut update failed.')
          : 'Shortcut update failed.'
        setShortcutSaveState((previous) => ({ ...previous, error: message }))
        return
      }

      setShortcutSaveState({
        isCapturing: false,
        draft: accelerator,
        error: null
      })
      setShortcutCaptureSessionActive(false)

      await queryClient.invalidateQueries({ queryKey: onboardingShortcutsKeys.config() })
    },
    [queryClient, setShortcutCaptureSessionActive, updateShortcutMutation]
  )

  const onShortcutCaptureKeyDown = useCallback(
    (event: ShortcutCaptureKeyEvent): void => {
      event.preventDefault()
      event.stopPropagation()

      if (!shortcutSaveState.isCapturing || updateShortcutMutation.isPending) {
        return
      }

      const isEscapeKey =
        event.key.toLowerCase() === 'escape' ||
        event.key.toLowerCase() === 'esc' ||
        event.code === 'Escape' ||
        event.keyCode === 27

      if (isEscapeKey && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        updateShortcutMutation.reset()
        setShortcutSaveState((previous) => ({
          ...previous,
          isCapturing: false
        }))
        setShortcutCaptureSessionActive(false)
        return
      }

      const accelerator = buildAcceleratorFromKeyEvent(event, platform)
      if (!accelerator) {
        return
      }

      setShortcutSaveState((previous) => ({
        ...previous,
        draft: accelerator,
        error: null
      }))

      void persistShortcut(accelerator)
    },
    [
      persistShortcut,
      platform,
      setShortcutCaptureSessionActive,
      shortcutSaveState.isCapturing,
      updateShortcutMutation
    ]
  )

  const startShortcutCapture = useCallback((): void => {
    updateShortcutMutation.reset()
    setShortcutCaptureSessionActive(true)
    setShortcutSaveState({ isCapturing: true, draft: currentShortcut, error: null })
  }, [currentShortcut, setShortcutCaptureSessionActive, updateShortcutMutation])

  const stopShortcutCapture = useCallback((): void => {
    updateShortcutMutation.reset()
    setShortcutCaptureSessionActive(false)
    setShortcutSaveState((previous) => ({ ...previous, isCapturing: false }))
  }, [setShortcutCaptureSessionActive, updateShortcutMutation])

  return {
    accelerator: currentShortcut,
    display: currentShortcutDisplay,
    isCapturing: shortcutSaveState.isCapturing,
    draft: shortcutSaveState.draft,
    error: shortcutSaveState.error,
    idleHint: 'Works in any app.',
    recordingHint: 'Press Esc to cancel.',
    startShortcutCapture,
    stopShortcutCapture,
    onShortcutCaptureKeyDown
  }
}
