import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { recordingKeys } from './recording.keys'
import type {
  RecordingPreferencesResponse,
  RecordingPreferencesUpdateInput
} from './recording.types'

export function useUpdateRecordingPreferencesMutation(): UseMutationResult<
  RecordingPreferencesResponse,
  Error,
  RecordingPreferencesUpdateInput
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RecordingPreferencesUpdateInput) =>
      window.api.recording.updatePreferences(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: recordingKeys.preferences() })
    }
  })
}
