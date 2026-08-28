import type {
  TranscriptionConfig,
  TranscriptionPreferences,
  TranscriptionProviderId
} from './transcription'

export const MEETING_AUDIO_EXTENSIONS = [
  'flac',
  'm4a',
  'mp3',
  'mp4',
  'mpeg',
  'mov',
  'ogg',
  'wav',
  'webm'
] as const

export type MeetingStatus =
  | 'queued'
  | 'processing'
  | 'cancelling'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled'

export type MeetingListItem = {
  id: string
  title: string
  sourceFileName: string
  status: MeetingStatus
  providerId: string
  modelId: string
  createdAt: number
  updatedAt: number
  durationMs: number | null
  completedChunks: number
  totalChunks: number
  errorMessage: string | null
}

export type MeetingSegment = {
  id: number
  meetingId: string
  chunkIndex: number
  startMs: number
  endMs: number
  text: string
  createdAt: number
}

export type MeetingDetails = MeetingListItem & {
  segments: MeetingSegment[]
}

export type MeetingImportSelection = Pick<TranscriptionPreferences, 'providerId' | 'modelId'>

export type DownloadedMeetingModel = {
  providerId: TranscriptionProviderId
  providerLabel: string
  modelId: string
  label: string
  description?: string
  sizeMb?: number
  language?: string
}

export const getDownloadedMeetingModels = (config: TranscriptionConfig): DownloadedMeetingModel[] =>
  config.providers.flatMap((provider) =>
    provider.availability === 'available'
      ? provider.models.flatMap((model) =>
          model.downloaded
            ? [
                {
                  providerId: provider.id,
                  providerLabel: provider.label,
                  modelId: model.id,
                  label: model.label,
                  description: model.description,
                  sizeMb: model.sizeMb,
                  language: model.language
                }
              ]
            : []
        )
      : []
  )

export type ListMeetingsResponse = {
  items: MeetingListItem[]
}

export type GetMeetingInput = {
  meetingId: string
}

export type GetMeetingResponse = {
  meeting: MeetingDetails | null
}

export type ImportMeetingResponse =
  | {
      ok: true
      meeting: MeetingListItem
    }
  | {
      ok: false
      cancelled?: boolean
      message?: string
    }

export type MeetingActionInput = {
  meetingId: string
}

export type MeetingActionResponse = {
  ok: boolean
  message?: string
}
