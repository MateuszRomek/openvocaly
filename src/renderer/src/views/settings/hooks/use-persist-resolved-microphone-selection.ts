import { useEffect, useRef } from 'react'

type UsePersistResolvedMicrophoneSelectionInput = {
  isPermissionBlocked: boolean
  isPreferencesLoading: boolean
  isMutating: boolean
  isDevicesLoading: boolean
  resolvedDeviceId: string | null
  selectedMicrophoneDeviceId: string | null
  setSelectedMicrophoneDeviceId: (deviceId: string | null) => void
}

export function usePersistResolvedMicrophoneSelection({
  isPermissionBlocked,
  isPreferencesLoading,
  isMutating,
  isDevicesLoading,
  resolvedDeviceId,
  selectedMicrophoneDeviceId,
  setSelectedMicrophoneDeviceId
}: UsePersistResolvedMicrophoneSelectionInput): void {
  const attemptedTransitionRef = useRef<string | null>(null)

  useEffect(() => {
    if (isPermissionBlocked || isPreferencesLoading || isMutating || isDevicesLoading) {
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
    isDevicesLoading,
    isMutating,
    isPermissionBlocked,
    isPreferencesLoading,
    resolvedDeviceId,
    selectedMicrophoneDeviceId,
    setSelectedMicrophoneDeviceId
  ])
}
