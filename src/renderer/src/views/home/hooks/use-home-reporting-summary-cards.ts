import { useMemo } from 'react'
import type { HomeReportingRange } from '../constants/reporting-range'
import {
  formatAverageSessionDuration,
  formatReportingMinutes,
  formatReportingNumber
} from '../helpers/reporting-summary-formatters'
import { useHomeSummarySuspenseQuery } from '../queries/reporting/use-home-summary-suspense-query'

export type HomeReportingSummaryCard = {
  id: 'averageWpm' | 'wordsInRange' | 'lifetimeWords' | 'totalDictationTime'
  title: string
  value: string
  description: string
  percentage?: number | null
}

const formatRangeDescription = (range: HomeReportingRange): string => {
  switch (range) {
    case '7d':
      return 'Past week'
    case '30d':
      return 'Past month'
    case '90d':
      return 'Past quarter'
    case '12m':
      return 'Past year'
    default:
      return 'Selected range'
  }
}

export function useHomeReportingSummaryCards(
  range: HomeReportingRange
): ReadonlyArray<HomeReportingSummaryCard> {
  const summaryQuery = useHomeSummarySuspenseQuery({ range })

  return useMemo(() => {
    const { summary, deltas, lifetime } = summaryQuery.data

    return [
      {
        id: 'averageWpm',
        title: 'Average WPM',
        value: formatReportingNumber(Math.round(summary.averageWpm)),
        description: 'vs previous time range',
        percentage: deltas.averageWpmPct
      },
      {
        id: 'wordsInRange',
        title: 'Words dictated',
        value: formatReportingNumber(summary.words),
        description: formatRangeDescription(range),
        percentage: deltas.wordsPct
      },
      {
        id: 'lifetimeWords',
        title: 'Lifetime words',
        value: formatReportingNumber(lifetime.words),
        description: 'All sessions combined',
        percentage: null
      },
      {
        id: 'totalDictationTime',
        title: 'Total dictation time',
        value: formatReportingMinutes(summary.totalMinutes),
        description: `Average ${formatAverageSessionDuration(summary.totalMinutes, summary.sessions)}`,
        percentage: deltas.totalMinutesPct
      }
    ] as const
  }, [range, summaryQuery.data])
}
