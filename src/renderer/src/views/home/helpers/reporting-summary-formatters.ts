const reportingNumberFormatter = new Intl.NumberFormat('en-US')

export function formatReportingNumber(value: number): string {
  return reportingNumberFormatter.format(value)
}

export function formatReportingMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)

  if (hours <= 0) {
    return `${minutes}m`
  }

  return `${hours}h ${minutes}m`
}

export function formatDeltaPercent(value: number): string {
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
