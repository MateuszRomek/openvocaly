import { useMemo } from 'react'
import type { HomeReportingRange } from '../constants/reporting-range'
import { formatDailyOutputLabel } from '../helpers/reporting-timeline-formatters'
import { useHomeRangeTimelinesSuspenseQuery } from '../queries/reporting/use-home-range-timelines-suspense-query'

export type HomeDailyOutputPoint = {
  key: string
  label: string
  words: number
}

export type UseHomeDailyOutputChartResult = {
  points: HomeDailyOutputPoint[]
  hasActivity: boolean
}

export function useHomeDailyOutputChart(range: HomeReportingRange): UseHomeDailyOutputChartResult {
  const timelinesQuery = useHomeRangeTimelinesSuspenseQuery({ range })

  return useMemo(() => {
    const points = timelinesQuery.data.wordsTimeline.map((point) => ({
      key: point.key,
      label: formatDailyOutputLabel(point.key, range),
      words: point.words
    }))

    return {
      points,
      hasActivity: points.some((point) => point.words > 0)
    }
  }, [range, timelinesQuery.data.wordsTimeline])
}
