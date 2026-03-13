import { useMemo } from 'react'
import type { HomeReportingRange } from '../constants/reporting-range'
import { useHomeAppsSuspenseQuery } from '../queries/reporting/use-home-apps-suspense-query'

const TOP_APPS_LIMIT = 5

const CHART_APP_COLORS = [
  'oklch(0.646 0.222 41.116)',
  'oklch(0.6 0.118 184.704)',
  'oklch(0.398 0.07 227.392)',
  'oklch(0.828 0.189 84.429)',
  'oklch(0.769 0.188 70.08)'
] as const

export type HomeTopAppChartPoint = {
  appKey: string
  appLabel: string
  words: number
  sharePct: number
  fill: string
}

export type HomeTopAppDetailRow = {
  appKey: string
  appLabel: string
  words: number
  sharePct: number
  interactions: number
  averageWpm: number | null
}

export type UseHomeTopAppsResult = {
  topApps: HomeTopAppChartPoint[]
  appDetails: HomeTopAppDetailRow[]
  hasActivity: boolean
}

export function useHomeTopApps(range: HomeReportingRange): UseHomeTopAppsResult {
  const appsQuery = useHomeAppsSuspenseQuery({ range, topLimit: TOP_APPS_LIMIT })

  return useMemo(() => {
    const topApps = appsQuery.data.topApps.map((row, index) => ({
      appKey: row.appKey,
      appLabel: row.appLabel,
      words: row.words,
      sharePct: row.sharePct,
      fill: CHART_APP_COLORS[index] ?? CHART_APP_COLORS[CHART_APP_COLORS.length - 1]
    }))

    const appDetails = appsQuery.data.appDetails.map((row) => ({
      appKey: row.appKey,
      appLabel: row.appLabel,
      words: row.words,
      sharePct: row.sharePct,
      interactions: row.interactions,
      averageWpm: row.averageWpm
    }))

    return {
      topApps,
      appDetails,
      hasActivity: appDetails.some((row) => row.words > 0)
    }
  }, [appsQuery.data.appDetails, appsQuery.data.topApps])
}
