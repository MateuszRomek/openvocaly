import { useMemo } from 'react'
import type { HomeReportingRange } from '../constants/reporting-range'
import { formatWpmTrendLabel } from '../helpers/reporting-timeline-formatters'
import { useHomeRangeTimelinesSuspenseQuery } from '../queries/reporting/use-home-range-timelines-suspense-query'

export type HomeWpmTrendPoint = {
  key: string
  label: string
  wpm: number | null
  trend: number | null
}

export type UseHomeWpmTrendChartResult = {
  points: HomeWpmTrendPoint[]
  hasWpmData: boolean
  showTrendline: boolean
}

export function useHomeWpmTrendChart(range: HomeReportingRange): UseHomeWpmTrendChartResult {
  const timelinesQuery = useHomeRangeTimelinesSuspenseQuery({ range })

  return useMemo(() => {
    const points = timelinesQuery.data.wpmTimeline.map((point) => ({
      key: point.key,
      label: formatWpmTrendLabel(point.key, range),
      wpm: point.wpm,
      trend: point.rollingWpm
    }))

    const validWpmPointCount = points.filter((point) => point.wpm !== null).length
    const hasWpmData = validWpmPointCount >= 2
    const validTrendPointCount = points.filter((point) => point.trend !== null).length

    return {
      points,
      hasWpmData,
      showTrendline: validTrendPointCount >= 3
    }
  }, [range, timelinesQuery.data.wpmTimeline])
}
