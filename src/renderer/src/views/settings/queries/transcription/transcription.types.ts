export type TranscriptionPreferencesResponse = Awaited<
  ReturnType<typeof window.api.transcription.getPreferences>
>
export type TranscriptionPreferencesUpdateInput = Parameters<
  Window['api']['transcription']['updatePreferences']
>[0]
export type TranscriptionProviderApiKeyUpdateInput = Parameters<
  Window['api']['transcription']['setProviderApiKey']
>[0]
export type TranscriptionProviderApiKeyMutationResponse = Awaited<
  ReturnType<typeof window.api.transcription.setProviderApiKey>
>
