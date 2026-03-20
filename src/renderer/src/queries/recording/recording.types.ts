export type RecordingPreferencesResponse = Awaited<
  ReturnType<typeof window.api.recording.getPreferences>
>
export type RecordingPreferencesUpdateInput = Parameters<
  Window['api']['recording']['updatePreferences']
>[0]
