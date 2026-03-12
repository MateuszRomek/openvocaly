import { format } from 'date-fns'

const recentSessionWpmFormatter = new Intl.NumberFormat('en-US')

export function formatRecentSessionTimestamp(startedAt: number): string {
  const date = new Date(startedAt)
  return `${format(date, 'MMM d')} · ${format(date, 'HH:mm')}`
}

export function formatRecentSessionDuration(durationMinutes: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMinutes * 60))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

export function formatRecentSessionWpm(wpm: number | null): string {
  if (wpm === null) {
    return '—'
  }

  return recentSessionWpmFormatter.format(wpm)
}
