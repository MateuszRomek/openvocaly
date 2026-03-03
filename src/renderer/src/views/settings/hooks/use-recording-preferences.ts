import { useCallback, useMemo } from 'react'
import { useRecordingPreferencesQuery } from '../queries/recording/use-recording-preferences-query'
import { useUpdateRecordingPreferencesMutation } from '../queries/recording/use-update-recording-preferences-mutation'

type UseRecordingPreferencesResult = {
  isLoading: boolean
  isMutating: boolean
  requestError: string | null
  soundCuesEnabled: boolean
  setSoundCuesEnabled: (enabled: boolean) => void
  selectedMicrophoneDeviceId: string | null
  setSelectedMicrophoneDeviceId: (deviceId: string | null) => void
}

export function useRecordingPreferences(): UseRecordingPreferencesResult {
  const preferencesQuery = useRecordingPreferencesQuery()
  const updatePreferencesMutation = useUpdateRecordingPreferencesMutation()
  const mutatePreferences = updatePreferencesMutation.mutate

  const preferences = preferencesQuery.data?.preferences

  const requestError = useMemo(() => {
    if (preferencesQuery.isError) {
      return 'Could not load recording settings.'
    }

    if (updatePreferencesMutation.isError) {
      return 'Could not save recording settings. Try again.'
    }

    return null
  }, [preferencesQuery.isError, updatePreferencesMutation.isError])

  const setSoundCuesEnabled = useCallback(
    (enabled: boolean): void => {
      mutatePreferences({
        soundCues: { enabled }
      })
    },
    [mutatePreferences]
  )

  const setSelectedMicrophoneDeviceId = useCallback(
    (deviceId: string | null): void => {
      mutatePreferences({
        microphone: { selectedDeviceId: deviceId }
      })
    },
    [mutatePreferences]
  )

  return {
    isLoading: preferencesQuery.isPending,
    isMutating: updatePreferencesMutation.isPending,
    requestError,
    soundCuesEnabled: preferences?.soundCues.enabled ?? true,
    setSoundCuesEnabled,
    selectedMicrophoneDeviceId: preferences?.microphone.selectedDeviceId ?? null,
    setSelectedMicrophoneDeviceId
  }
}
