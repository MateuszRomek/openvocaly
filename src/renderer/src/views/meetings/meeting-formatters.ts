import type { MeetingStatus } from '../../../../shared/meetings'

export const formatMeetingDuration = (durationMs: number | null): string => {
  if (!durationMs) {
    return 'Preparing audio'
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

export const formatMeetingDate = (timestamp: number): string =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp)

export const meetingStatusLabel: Record<MeetingStatus, string> = {
  queued: 'Queued',
  processing: 'Transcribing',
  cancelling: 'Stopping',
  completed: 'Ready',
  partial: 'Partial',
  failed: 'Failed',
  cancelled: 'Cancelled'
}
