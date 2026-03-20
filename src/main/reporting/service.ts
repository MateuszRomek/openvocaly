import type {
  GetHomeAppsParams,
  GetHomeAppsResponse,
  GetHomeMonthlyOutputParams,
  GetHomeMonthlyOutputResponse,
  GetHomeRangeTimelinesParams,
  GetHomeRangeTimelinesResponse,
  GetHomeSummaryParams,
  GetHomeSummaryResponse,
  ReportingBaseParams,
  ReportingRange
} from '../../shared/reporting'
import { buildAppAggregates } from './core/apps'
import { hasSufficientDeltaBaseline, summarizeMetrics, toDeltaPct } from './core/metrics'
import {
  isReportingRange,
  normalizeAsOfMs,
  resolveSystemTimezone,
  resolveCurrentWindow,
  resolvePreviousWindow,
  resolveTrailingMonthsWindow
} from './core/period'
import { buildMonthlyOutput, buildWordsTimeline } from './core/timelines'
import { ReportingRepository } from './repository'
import type { ReportingReadStore } from './read-store'

const DEFAULT_TOP_LIMIT = 5
const MAX_TOP_LIMIT = 25

export class ReportingService {
  constructor(private readonly readStore: ReportingReadStore = new ReportingRepository()) {}

  async getHomeSummary(params: GetHomeSummaryParams): Promise<GetHomeSummaryResponse> {
    const base = this.normalizeBaseParams(params)
    const range = this.normalizeRange(params.range)

    const currentWindow = resolveCurrentWindow(range, base.asOfMs)
    const previousWindow = resolvePreviousWindow(range, base.asOfMs)

    const [currentMetrics, previousMetrics, lifetime] = await Promise.all([
      this.readStore.listMetricsInWindow(currentWindow),
      this.readStore.listMetricsInWindow(previousWindow),
      this.readStore.getLifetimeTotals()
    ])

    const summary = summarizeMetrics(currentMetrics)
    const previous = summarizeMetrics(previousMetrics)
    const shouldShowDeltas = hasSufficientDeltaBaseline(previous)

    return {
      range,
      timezone: base.timezone,
      asOfMs: base.asOfMs,
      summary,
      deltas: {
        averageWpmPct: shouldShowDeltas
          ? toDeltaPct(summary.averageWpm, previous.averageWpm)
          : null,
        wordsPct: shouldShowDeltas ? toDeltaPct(summary.words, previous.words) : null,
        totalMinutesPct: shouldShowDeltas
          ? toDeltaPct(summary.totalMinutes, previous.totalMinutes)
          : null,
        sessionsPct: shouldShowDeltas ? toDeltaPct(summary.sessions, previous.sessions) : null
      },
      lifetime
    }
  }

  async getHomeRangeTimelines(
    params: GetHomeRangeTimelinesParams
  ): Promise<GetHomeRangeTimelinesResponse> {
    const base = this.normalizeBaseParams(params)
    const range = this.normalizeRange(params.range)
    const currentWindow = resolveCurrentWindow(range, base.asOfMs)

    const metrics = await this.readStore.listMetricsInWindow(currentWindow)

    return {
      range,
      timezone: base.timezone,
      asOfMs: base.asOfMs,
      wordsTimeline: buildWordsTimeline(range, metrics, base.asOfMs, base.timezone)
    }
  }

  async getHomeMonthlyOutput(
    params: GetHomeMonthlyOutputParams
  ): Promise<GetHomeMonthlyOutputResponse> {
    const base = this.normalizeBaseParams(params)
    const window = resolveTrailingMonthsWindow(base.asOfMs, 13)

    const metrics = await this.readStore.listMetricsInWindow(window)

    return {
      timezone: base.timezone,
      asOfMs: base.asOfMs,
      monthlyWords: buildMonthlyOutput(metrics, base.timezone, base.asOfMs)
    }
  }

  async getHomeApps(params: GetHomeAppsParams): Promise<GetHomeAppsResponse> {
    const base = this.normalizeBaseParams(params)
    const range = this.normalizeRange(params.range)
    const currentWindow = resolveCurrentWindow(range, base.asOfMs)

    const topLimit = this.normalizeTopLimit(params.topLimit)
    const metrics = await this.readStore.listMetricsInWindow(currentWindow)
    const aggregates = buildAppAggregates(metrics, topLimit)

    return {
      range,
      timezone: base.timezone,
      asOfMs: base.asOfMs,
      totalWords: aggregates.totalWords,
      topApps: aggregates.topApps,
      appDetails: aggregates.appDetails
    }
  }

  private normalizeBaseParams(params: ReportingBaseParams): { timezone: string; asOfMs: number } {
    return {
      timezone: resolveSystemTimezone(),
      asOfMs: normalizeAsOfMs(params.asOfMs)
    }
  }

  private normalizeRange(range: ReportingRange): ReportingRange {
    if (!isReportingRange(range)) {
      throw new Error(`Unsupported reporting range: ${range}`)
    }

    return range
  }

  private normalizeTopLimit(value?: number): number {
    if (!value || value <= 0) {
      return DEFAULT_TOP_LIMIT
    }

    return Math.min(MAX_TOP_LIMIT, Math.floor(value))
  }
}
