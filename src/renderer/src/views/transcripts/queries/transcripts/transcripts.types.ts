export type TranscriptsListResponse = Awaited<ReturnType<typeof window.api.storage.listTranscripts>>

export type TranscriptsListQueryInput = NonNullable<
  Parameters<Window['api']['storage']['listTranscripts']>[0]
>

export type TranscriptsListItem = TranscriptsListResponse['items'][number]
