const reportingNumberFormatter = new Intl.NumberFormat('en-US')
const MAX_DISPLAY_DELTA_PERCENT = 999

export function formatReportingNumber(value: number): string {
  return reportingNumberFormatter.format(value)
}

export function formatReportingMinutes(totalMinutes: number): string {
  const roundedTotalMinutes = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(roundedTotalMinutes / 60)
  const minutes = roundedTotalMinutes % 60

  if (hours <= 0) {
    return `${minutes}m`
  }

  return `${hours}h ${minutes}m`
}

export function formatAverageSessionDuration(totalMinutes: number, sessions: number): string {
  if (sessions <= 0) {
    return 'No sessions in range'
  }

  const averageSeconds = (totalMinutes * 60) / sessions

  if (averageSeconds < 60) {
    const roundedSeconds = Math.max(1, Math.round(averageSeconds))
    return `${roundedSeconds}s per session`
  }

  return `${formatReportingMinutes(averageSeconds / 60)} per session`
}

export function formatDeltaPercent(value: number): string {
  if (Math.abs(value) > MAX_DISPLAY_DELTA_PERCENT) {
    return `${value > 0 ? '+' : '-'}${MAX_DISPLAY_DELTA_PERCENT}%`
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function resolveDeltaVariant(value: number): 'success' | 'destructive' | 'outline' {
  if (value > 0) {
    return 'success'
  }

  if (value < 0) {
    return 'destructive'
  }

  return 'outline'
}
