import { useCallback, useMemo } from 'react'
import { useRecordingPreferencesQuery } from '../queries/recording/use-recording-preferences-query'
import { useUpdateRecordingPreferencesMutation } from '../queries/recording/use-update-recording-preferences-mutation'

type UseRecordingPreferencesResult = {
  isLoading: boolean
  isMutating: boolean
  requestError: string | null
  soundCuesEnabled: boolean
  setSoundCuesEnabled: (enabled: boolean) => void
}

export function useRecordingPreferences(): UseRecordingPreferencesResult {
  const preferencesQuery = useRecordingPreferencesQuery()
  const updatePreferencesMutation = useUpdateRecordingPreferencesMutation()

  const preferences = preferencesQuery.data?.preferences

  const requestError = useMemo(() => {
    if (preferencesQuery.isError) {
      return 'Failed to load recording preferences.'
    }

    if (updatePreferencesMutation.isError) {
      return 'Failed to save recording preferences. Please retry.'
    }

    return null
  }, [preferencesQuery.isError, updatePreferencesMutation.isError])

  const setSoundCuesEnabled = useCallback(
    (enabled: boolean): void => {
      updatePreferencesMutation.mutate({
        soundCues: { enabled }
      })
    },
    [updatePreferencesMutation]
  )

  return {
    isLoading: preferencesQuery.isPending,
    isMutating: updatePreferencesMutation.isPending,
    requestError,
    soundCuesEnabled: preferences?.soundCues.enabled ?? true,
    setSoundCuesEnabled
  }
}
