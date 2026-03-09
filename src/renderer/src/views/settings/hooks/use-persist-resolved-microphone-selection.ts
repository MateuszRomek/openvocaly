import { useEffect, useRef } from 'react'

type UsePersistResolvedMicrophoneSelectionInput = {
  canPersistResolvedSelection: boolean
  resolvedDeviceId: string | null
  selectedMicrophoneDeviceId: string | null
  setSelectedMicrophoneDeviceId: (deviceId: string | null) => void
}

export function usePersistResolvedMicrophoneSelection({
  canPersistResolvedSelection,
  resolvedDeviceId,
  selectedMicrophoneDeviceId,
  setSelectedMicrophoneDeviceId
}: UsePersistResolvedMicrophoneSelectionInput): void {
  const attemptedTransitionRef = useRef<string | null>(null)

  useEffect(() => {
    if (!canPersistResolvedSelection) {
      return
    }

    // Only auto-persist initial resolution when no explicit microphone has been selected yet.
    if (selectedMicrophoneDeviceId !== null) {
      return
    }

    if (!resolvedDeviceId || resolvedDeviceId === selectedMicrophoneDeviceId) {
      return
    }

    const transitionKey = `${selectedMicrophoneDeviceId ?? 'none'}=>${resolvedDeviceId}`
    if (attemptedTransitionRef.current === transitionKey) {
      return
    }

    attemptedTransitionRef.current = transitionKey
    setSelectedMicrophoneDeviceId(resolvedDeviceId)
  }, [
    canPersistResolvedSelection,
    resolvedDeviceId,
    selectedMicrophoneDeviceId,
    setSelectedMicrophoneDeviceId
  ])
}
