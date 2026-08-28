import { useCallback, useMemo } from 'react'
import { RECORDING_COPY } from '@renderer/constants/recording'
import { useRecordingPreferencesQuery } from '@renderer/queries/recording/use-recording-preferences-query'
import { useUpdateRecordingPreferencesMutation } from '@renderer/queries/recording/use-update-recording-preferences-mutation'
import { DEFAULT_RECORDING_SOUND_CUE_SETTINGS } from '../../../../shared/recording'

type UseRecordingPreferencesResult = {
  isLoading: boolean
  isMutating: boolean
  requestError: string | null
  soundCuesEnabled: boolean
  setSoundCuesEnabled: (enabled: boolean) => void
  soundCuesVolume: number
  setSoundCuesVolume: (volume: number) => void
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
      return RECORDING_COPY.errors.loadRecordingSettings
    }

    if (updatePreferencesMutation.isError) {
      return RECORDING_COPY.errors.saveRecordingSettings
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

  const setSoundCuesVolume = useCallback(
    (volume: number): void => {
      mutatePreferences({
        soundCues: { volume }
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
    soundCuesVolume: preferences?.soundCues.volume ?? DEFAULT_RECORDING_SOUND_CUE_SETTINGS.volume,
    setSoundCuesVolume,
    selectedMicrophoneDeviceId: preferences?.microphone.selectedDeviceId ?? null,
    setSelectedMicrophoneDeviceId
  }
}
