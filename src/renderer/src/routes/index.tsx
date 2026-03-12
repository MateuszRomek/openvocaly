import { createFileRoute } from '@tanstack/react-router'
import { HomeView } from '@renderer/views/home'
import {
  DEFAULT_HOME_REPORTING_RANGE,
  isHomeReportingRange,
  type HomeReportingRange
} from '@renderer/views/home/constants/reporting-range'

export const Route = createFileRoute('/')({
  validateSearch: (
    search: Record<string, unknown>
  ): {
    range: HomeReportingRange
  } => {
    const rawRange = search.range
    const range =
      typeof rawRange === 'string' && isHomeReportingRange(rawRange)
        ? rawRange
        : DEFAULT_HOME_REPORTING_RANGE

    return { range }
  },
  component: HomeView
})
