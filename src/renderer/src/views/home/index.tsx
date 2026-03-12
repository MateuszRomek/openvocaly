import { Suspense, useMemo, useTransition } from 'react'
import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ErrorBoundary } from 'react-error-boundary'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/ui/card'
import { HomeReportingFallback } from './components/home-reporting-fallback'
import { HomeDailyOutputCard } from './components/home-daily-output-card'
import { HomeDailyOutputCardSkeleton } from './components/home-daily-output-card-skeleton'
import { HomeMonthlyOutputCard } from './components/home-monthly-output-card'
import { HomeMonthlyOutputCardSkeleton } from './components/home-monthly-output-card-skeleton'
import { HomeReportingRangeTabs } from './components/home-reporting-range-tabs'
import { HomeReportingSummaryRow } from './components/home-reporting-summary-row'
import { HomeReportingSummaryRowSkeleton } from './components/home-reporting-summary-row-skeleton'
import { HomeTopAppsCard } from './components/home-top-apps-card'
import { HomeTopAppsCardSkeleton } from './components/home-top-apps-card-skeleton'
import { HomeWpmTrendCard } from './components/home-wpm-trend-card'
import { HomeWpmTrendCardSkeleton } from './components/home-wpm-trend-card-skeleton'
import { type HomeReportingRange } from './constants/reporting-range'

const numberFormatter = new Intl.NumberFormat('en-US')

type RecentSessionRow = {
  at: string
  words: number
  wpm: number
  durationMinutes: number
  app: string
}

const RECENT_SESSIONS_BY_RANGE: Record<HomeReportingRange, RecentSessionRow[]> = {
  '7d': [
    { at: 'Mar 11 · 10:42', words: 382, wpm: 129, durationMinutes: 2.95, app: 'Slack' },
    { at: 'Mar 11 · 09:18', words: 274, wpm: 121, durationMinutes: 2.26, app: 'Notion' },
    { at: 'Mar 10 · 17:53', words: 198, wpm: 113, durationMinutes: 1.75, app: 'Gmail' },
    { at: 'Mar 10 · 14:07', words: 351, wpm: 125, durationMinutes: 2.8, app: 'Linear' },
    { at: 'Mar 9 · 11:33', words: 142, wpm: 109, durationMinutes: 1.3, app: 'Slack' },
    { at: 'Mar 9 · 08:20', words: 304, wpm: 117, durationMinutes: 2.6, app: 'Notion' }
  ],
  '30d': [
    { at: 'Mar 28 · 10:42', words: 386, wpm: 126, durationMinutes: 3.06, app: 'Slack' },
    { at: 'Mar 27 · 16:03', words: 241, wpm: 118, durationMinutes: 2.05, app: 'Notion' },
    { at: 'Mar 27 · 11:16', words: 332, wpm: 131, durationMinutes: 2.54, app: 'Gmail' },
    { at: 'Mar 26 · 18:20', words: 417, wpm: 134, durationMinutes: 3.11, app: 'Linear' },
    { at: 'Mar 26 · 13:07', words: 168, wpm: 104, durationMinutes: 1.62, app: 'Slack' },
    { at: 'Mar 25 · 09:41', words: 295, wpm: 122, durationMinutes: 2.42, app: 'Notion' }
  ],
  '90d': [
    { at: 'Mar 27 · 16:03', words: 332, wpm: 131, durationMinutes: 2.54, app: 'Gmail' },
    { at: 'Mar 26 · 18:20', words: 417, wpm: 134, durationMinutes: 3.11, app: 'Linear' },
    { at: 'Mar 22 · 11:44', words: 276, wpm: 120, durationMinutes: 2.3, app: 'Slack' },
    { at: 'Mar 20 · 15:12', words: 364, wpm: 127, durationMinutes: 2.87, app: 'Notion' },
    { at: 'Mar 18 · 09:05', words: 201, wpm: 111, durationMinutes: 1.81, app: 'Gmail' },
    { at: 'Mar 16 · 08:38', words: 347, wpm: 124, durationMinutes: 2.8, app: 'Slack' }
  ],
  '12m': [
    { at: 'Mar 27 · 16:03', words: 332, wpm: 131, durationMinutes: 2.54, app: 'Gmail' },
    { at: 'Mar 11 · 10:42', words: 382, wpm: 129, durationMinutes: 2.95, app: 'Slack' },
    { at: 'Feb 26 · 14:19', words: 291, wpm: 121, durationMinutes: 2.4, app: 'Notion' },
    { at: 'Jan 15 · 09:58', words: 244, wpm: 114, durationMinutes: 2.14, app: 'Linear' },
    { at: 'Dec 21 · 18:07', words: 317, wpm: 119, durationMinutes: 2.66, app: 'Gmail' },
    { at: 'Nov 10 · 11:26', words: 276, wpm: 112, durationMinutes: 2.46, app: 'Slack' }
  ]
}

function formatSessionDuration(minutes: number): string {
  const totalSeconds = Math.max(0, Math.round(minutes * 60))
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}m ${secs.toString().padStart(2, '0')}s`
}

export function HomeView(): React.JSX.Element {
  const search = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  const [, startTransition] = useTransition()
  const selectedRange = search.range

  const recentSessions = useMemo(() => RECENT_SESSIONS_BY_RANGE[selectedRange], [selectedRange])

  const handleRangeChange = (nextRange: HomeReportingRange): void => {
    if (nextRange === selectedRange) {
      return
    }

    startTransition(() => {
      void navigate({
        search: (previous) => ({
          ...previous,
          range: nextRange
        })
      })
    })
  }

  return (
    <section className="relative w-full space-y-5 py-1 sm:space-y-6 sm:py-2">
      <div className="pointer-events-none absolute inset-x-8 top-2 -z-10 h-52 rounded-[2rem] bg-gradient-to-r from-chart-3/10 via-chart-2/10 to-chart-1/10 blur-3xl" />

      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary
            onReset={reset}
            resetKeys={[selectedRange]}
            fallbackRender={({ resetErrorBoundary }) => (
              <HomeReportingFallback resetErrorBoundary={resetErrorBoundary} />
            )}
          >
            <header className="space-y-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="space-y-1.5">
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Home</h2>
                  <p className="text-muted-foreground text-sm">
                    Track output, speed, and app usage.
                  </p>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <HomeReportingRangeTabs value={selectedRange} onChange={handleRangeChange} />
                </div>
              </div>
            </header>

            <Suspense fallback={<HomeReportingSummaryRowSkeleton />}>
              <HomeReportingSummaryRow range={selectedRange} />
            </Suspense>

            <Suspense fallback={<HomeDailyOutputCardSkeleton />}>
              <HomeDailyOutputCard range={selectedRange} />
            </Suspense>

            <div className="grid gap-4 xl:grid-cols-2">
              <Suspense fallback={<HomeWpmTrendCardSkeleton />}>
                <HomeWpmTrendCard range={selectedRange} />
              </Suspense>

              <Suspense fallback={<HomeMonthlyOutputCardSkeleton />}>
                <HomeMonthlyOutputCard />
              </Suspense>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Suspense fallback={<HomeTopAppsCardSkeleton />}>
                <HomeTopAppsCard range={selectedRange} />
              </Suspense>

              <Card className="bg-card/95 ring-foreground/8">
                <CardHeader className="border-border/50 border-b">
                  <CardTitle>Recent sessions</CardTitle>
                  <CardDescription>Latest dictations in selected range.</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="border-border/60 bg-background/60 grid grid-cols-[1.45fr_0.8fr_0.6fr_0.9fr_0.9fr] items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-medium tracking-wide uppercase">
                    <span className="text-muted-foreground">Time</span>
                    <span className="text-muted-foreground text-right">Words</span>
                    <span className="text-muted-foreground text-right">WPM</span>
                    <span className="text-muted-foreground text-right">Duration</span>
                    <span className="text-muted-foreground text-right">App</span>
                  </div>

                  <div className="mt-2 space-y-2">
                    {recentSessions.length > 0 ? (
                      recentSessions.map((session) => (
                        <div
                          key={`${session.at}-${session.app}-${session.words}`}
                          className="border-border/60 bg-background/60 grid grid-cols-[1.45fr_0.8fr_0.6fr_0.9fr_0.9fr] items-center gap-2 rounded-lg border px-3 py-2"
                        >
                          <span className="text-sm font-medium">{session.at}</span>
                          <span className="text-right font-mono text-sm tabular-nums">
                            {numberFormatter.format(session.words)}
                          </span>
                          <span className="text-right font-mono text-sm tabular-nums">
                            {numberFormatter.format(session.wpm)}
                          </span>
                          <span className="text-muted-foreground text-right font-mono text-xs tabular-nums">
                            {formatSessionDuration(session.durationMinutes)}
                          </span>
                          <span className="text-muted-foreground text-right text-xs">
                            {session.app}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="border-border/60 bg-background/60 rounded-lg border px-3 py-4">
                        <p className="text-sm font-medium">No sessions yet</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Start a dictation to see your stats.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    </section>
  )
}
