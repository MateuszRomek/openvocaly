import { useEffect, useState, type RefObject } from 'react'
import {
  DICTATION_OVERLAY_STATE_CHANNEL,
  type DictationOverlayState
} from '../../../shared/dictation'
import { resolveOverlayMessage } from '../../../shared/overlay-presentation'
import { toTargetBars } from '@renderer/overlay-visualizer-helpers'
import {
  isSameManualPasteOverlayState,
  toManualPasteOverlayState,
  type ManualPasteOverlayState
} from '@renderer/overlay-ipc-state-helpers'

type UseOverlayIpcStateInput = {
  currentPhaseRef: RefObject<DictationOverlayState['phase']>
  targetBarsRef: RefObject<number[]>
  hasMessageRef: RefObject<boolean>
}

type UseOverlayIpcStateResult = {
  message: string | null
  manualPasteState: ManualPasteOverlayState
}

export function useOverlayIpcState({
  currentPhaseRef,
  targetBarsRef,
  hasMessageRef
}: UseOverlayIpcStateInput): UseOverlayIpcStateResult {
  const [message, setMessage] = useState<string | null>(null)
  const [manualPasteState, setManualPasteState] = useState<ManualPasteOverlayState>(null)

  useEffect(() => {
    const detach = window.electron.ipcRenderer.on(
      DICTATION_OVERLAY_STATE_CHANNEL,
      (_event, state: DictationOverlayState) => {
        currentPhaseRef.current = state.phase
        targetBarsRef.current = toTargetBars(state)

        const nextManualPasteState = toManualPasteOverlayState(state)
        setManualPasteState((previous) =>
          isSameManualPasteOverlayState(previous, nextManualPasteState)
            ? previous
            : nextManualPasteState
        )

        const nextMessage = nextManualPasteState ? null : resolveOverlayMessage(state)
        hasMessageRef.current = Boolean(nextMessage) || nextManualPasteState !== null
        setMessage((previous) => (previous === nextMessage ? previous : nextMessage))
      }
    )

    return () => {
      detach()
    }
  }, [currentPhaseRef, targetBarsRef, hasMessageRef])

  return { message, manualPasteState }
}
