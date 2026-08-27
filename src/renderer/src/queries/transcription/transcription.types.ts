export type TranscriptionPreferencesResponse = Awaited<
  ReturnType<typeof window.api.transcription.preferences.get>
>
export type TranscriptionPreferencesUpdateInput = Parameters<
  Window['api']['transcription']['preferences']['update']
>[0]
