import { useMemo } from 'react'
import { formatMonthlyOutputLabel } from '../helpers/reporting-timeline-formatters'
import { useHomeMonthlyOutputSuspenseQuery } from '../queries/reporting/use-home-monthly-output-suspense-query'

export type HomeMonthlyTimeWindow = '6m' | '12m'

export type HomeMonthlyOutputPoint = {
  key: string
  label: string
  words: number
}

export type UseHomeMonthlyOutputChartResult = {
  points: HomeMonthlyOutputPoint[]
  hasActivity: boolean
}

export function useHomeMonthlyOutputChart(
  timeWindow: HomeMonthlyTimeWindow
): UseHomeMonthlyOutputChartResult {
  const monthlyOutputQuery = useHomeMonthlyOutputSuspenseQuery({})

  return useMemo(() => {
    const allPoints = monthlyOutputQuery.data.monthlyWords.map((point) => ({
      key: point.key,
      label: formatMonthlyOutputLabel(point.key),
      words: point.words
    }))

    const points = timeWindow === '6m' ? allPoints.slice(-6) : allPoints

    return {
      points,
      hasActivity: points.some((point) => point.words > 0)
    }
  }, [timeWindow, monthlyOutputQuery.data.monthlyWords])
}
