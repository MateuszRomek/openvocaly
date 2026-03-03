import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { transcriptionKeys } from './transcription.keys'
import type {
  TranscriptionPreferencesResponse,
  TranscriptionPreferencesUpdateInput
} from './transcription.types'

export function useUpdateTranscriptionPreferencesMutation(): UseMutationResult<
  TranscriptionPreferencesResponse,
  Error,
  TranscriptionPreferencesUpdateInput
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: TranscriptionPreferencesUpdateInput) =>
      window.api.transcription.updatePreferences(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: transcriptionKeys.preferences() })
    }
  })
}
