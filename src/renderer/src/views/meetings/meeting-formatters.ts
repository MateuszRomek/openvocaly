import { getLocalModelDefinition } from '../../../../shared/local-model-catalog'
import type { MeetingStatus } from '../../../../shared/meetings'

export const formatMeetingDuration = (durationMs: number | null): string => {
  if (!durationMs) {
    return 'Preparing audio…'
  }

  if (durationMs < 60_000) {
    return `${Math.max(1, Math.round(durationMs / 1000))} sec`
  }

  const totalMinutes = Math.max(1, Math.round(durationMs / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) {
    return `${minutes} min`
  }
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`
}

export const formatMeetingTimestamp = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

export const formatMeetingElapsed = (startedAt: number, now = Date.now()): string => {
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  if (elapsedSeconds < 1) {
    return 'Starting…'
  }

  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s elapsed`
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m elapsed`
  }

  const hours = Math.floor(elapsedMinutes / 60)
  const minutes = elapsedMinutes % 60
  return minutes === 0 ? `${hours}h elapsed` : `${hours}h ${minutes}m elapsed`
}

export const formatMeetingListDate = (timestamp: number): string =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric'
  }).format(timestamp)

const generatedAudioTitlePattern =
  /^AUDIO[-_](\d{4})[-_](\d{2})[-_](\d{2})[-_](\d{2})[-_](\d{2})(?:[-_](\d{2}))?$/i

export const formatMeetingTitle = (title: string): string => {
  const match = generatedAudioTitlePattern.exec(title.trim())
  if (!match) {
    return title
  }

  const [, year, month, day, hour, minute] = match
  const date = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(Date.UTC(Number(year), Number(month) - 1, Number(day)))

  return `${date} · ${hour}:${minute}`
}

export const formatMeetingModelLabel = (modelId: string): string =>
  getLocalModelDefinition(modelId)?.label ?? modelId

export const meetingStatusLabel: Record<MeetingStatus, string> = {
  queued: 'Waiting',
  processing: 'Transcribing',
  cancelling: 'Stopping',
  completed: 'Ready',
  partial: 'Incomplete',
  failed: 'Needs attention',
  cancelled: 'Cancelled'
}
