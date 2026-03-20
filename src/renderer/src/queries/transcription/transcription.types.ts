export type TranscriptionPreferencesResponse = Awaited<
  ReturnType<typeof window.api.transcription.preferences.get>
>
export type TranscriptionPreferencesUpdateInput = Parameters<
  Window['api']['transcription']['preferences']['update']
>[0]
export type TranscriptionProviderApiKeyUpdateInput = Parameters<
  Window['api']['transcription']['cloud']['setProviderApiKey']
>[0]
export type TranscriptionProviderApiKeyMutationResponse = Awaited<
  ReturnType<typeof window.api.transcription.cloud.setProviderApiKey>
>
