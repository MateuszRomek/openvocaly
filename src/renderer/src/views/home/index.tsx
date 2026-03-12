import { Suspense, useMemo, useTransition } from 'react'
import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ErrorBoundary } from 'react-error-boundary'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis
} from 'recharts'
import {
  CardAction,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@renderer/ui/card'
import { Button } from '@renderer/ui/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@renderer/ui/chart'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@renderer/ui/sheet'
import { HomeReportingFallback } from './components/home-reporting-fallback'
import { HomeDailyOutputCard } from './components/home-daily-output-card'
import { HomeDailyOutputCardSkeleton } from './components/home-daily-output-card-skeleton'
import { HomeReportingRangeTabs } from './components/home-reporting-range-tabs'
import { HomeReportingSummaryRow } from './components/home-reporting-summary-row'
import { HomeReportingSummaryRowSkeleton } from './components/home-reporting-summary-row-skeleton'
import { type HomeReportingRange } from './constants/reporting-range'

type HomeRangeMockData = {
  summary: {
    averageWpm: number
    words: number
    totalMinutes: number
    sessions: number
  }
  wordsTimeline: Array<{ label: string; words: number }>
  wpmTimeline: Array<{ label: string; wpm: number; rolling: number }>
  monthlyWords: Array<{ month: string; words: number }>
  appUsage: Array<{ app: string; words: number; fill: string }>
}
const MOCK_RANGE_DATA: Record<HomeReportingRange, HomeRangeMockData> = {
  '7d': {
    summary: {
      averageWpm: 117,
      words: 3190,
      totalMinutes: 72,
      sessions: 12
    },
    wordsTimeline: [
      { label: 'Mon', words: 420 },
      { label: 'Tue', words: 530 },
      { label: 'Wed', words: 470 },
      { label: 'Thu', words: 390 },
      { label: 'Fri', words: 560 },
      { label: 'Sat', words: 380 },
      { label: 'Sun', words: 440 }
    ],
    wpmTimeline: [
      { label: 'Mon', wpm: 104, rolling: 102 },
      { label: 'Tue', wpm: 114, rolling: 106 },
      { label: 'Wed', wpm: 118, rolling: 111 },
      { label: 'Thu', wpm: 112, rolling: 113 },
      { label: 'Fri', wpm: 125, rolling: 116 },
      { label: 'Sat', wpm: 119, rolling: 118 },
      { label: 'Sun', wpm: 129, rolling: 121 }
    ],
    monthlyWords: [
      { month: 'Oct', words: 7200 },
      { month: 'Nov', words: 7840 },
      { month: 'Dec', words: 7810 },
      { month: 'Jan', words: 9630 },
      { month: 'Feb', words: 11210 },
      { month: 'Mar', words: 12840 }
    ],
    appUsage: [
      { app: 'Slack', words: 1050, fill: 'var(--color-chart-1)' },
      { app: 'Notion', words: 840, fill: 'var(--color-chart-2)' },
      { app: 'Gmail', words: 730, fill: 'var(--color-chart-3)' },
      { app: 'Linear', words: 570, fill: 'var(--color-chart-4)' }
    ]
  },
  '30d': {
    summary: {
      averageWpm: 121,
      words: 12480,
      totalMinutes: 281,
      sessions: 47
    },
    wordsTimeline: [
      { label: 'Mar 1', words: 360 },
      { label: 'Mar 3', words: 420 },
      { label: 'Mar 5', words: 390 },
      { label: 'Mar 7', words: 510 },
      { label: 'Mar 9', words: 450 },
      { label: 'Mar 11', words: 530 },
      { label: 'Mar 13', words: 470 },
      { label: 'Mar 15', words: 620 },
      { label: 'Mar 17', words: 590 },
      { label: 'Mar 19', words: 560 },
      { label: 'Mar 21', words: 640 },
      { label: 'Mar 23', words: 580 },
      { label: 'Mar 25', words: 700 },
      { label: 'Mar 27', words: 660 }
    ],
    wpmTimeline: [
      { label: 'Mar 1', wpm: 102, rolling: 101 },
      { label: 'Mar 3', wpm: 108, rolling: 103 },
      { label: 'Mar 5', wpm: 112, rolling: 106 },
      { label: 'Mar 7', wpm: 116, rolling: 109 },
      { label: 'Mar 9', wpm: 111, rolling: 110 },
      { label: 'Mar 11', wpm: 123, rolling: 113 },
      { label: 'Mar 13', wpm: 118, rolling: 115 },
      { label: 'Mar 15', wpm: 126, rolling: 117 },
      { label: 'Mar 17', wpm: 121, rolling: 118 },
      { label: 'Mar 19', wpm: 127, rolling: 120 },
      { label: 'Mar 21', wpm: 129, rolling: 122 },
      { label: 'Mar 23', wpm: 125, rolling: 123 },
      { label: 'Mar 25', wpm: 131, rolling: 125 },
      { label: 'Mar 27', wpm: 134, rolling: 127 }
    ],
    monthlyWords: [
      { month: 'Oct', words: 7200 },
      { month: 'Nov', words: 7840 },
      { month: 'Dec', words: 7810 },
      { month: 'Jan', words: 9630 },
      { month: 'Feb', words: 11210 },
      { month: 'Mar', words: 12840 }
    ],
    appUsage: [
      { app: 'Slack', words: 4210, fill: 'var(--color-chart-1)' },
      { app: 'Notion', words: 3370, fill: 'var(--color-chart-2)' },
      { app: 'Gmail', words: 2870, fill: 'var(--color-chart-3)' },
      { app: 'Linear', words: 2030, fill: 'var(--color-chart-4)' }
    ]
  },
  '90d': {
    summary: {
      averageWpm: 118,
      words: 33820,
      totalMinutes: 768,
      sessions: 126
    },
    wordsTimeline: [
      { label: 'W1', words: 1860 },
      { label: 'W2', words: 1940 },
      { label: 'W3', words: 2210 },
      { label: 'W4', words: 2150 },
      { label: 'W5', words: 2320 },
      { label: 'W6', words: 2480 },
      { label: 'W7', words: 2570 },
      { label: 'W8', words: 2710 },
      { label: 'W9', words: 2860 },
      { label: 'W10', words: 3010 },
      { label: 'W11', words: 3160 },
      { label: 'W12', words: 3330 }
    ],
    wpmTimeline: [
      { label: 'W1', wpm: 101, rolling: 101 },
      { label: 'W2', wpm: 106, rolling: 103 },
      { label: 'W3', wpm: 111, rolling: 106 },
      { label: 'W4', wpm: 108, rolling: 107 },
      { label: 'W5', wpm: 114, rolling: 108 },
      { label: 'W6', wpm: 117, rolling: 111 },
      { label: 'W7', wpm: 119, rolling: 113 },
      { label: 'W8', wpm: 121, rolling: 115 },
      { label: 'W9', wpm: 123, rolling: 117 },
      { label: 'W10', wpm: 125, rolling: 119 },
      { label: 'W11', wpm: 129, rolling: 121 },
      { label: 'W12', wpm: 132, rolling: 123 }
    ],
    monthlyWords: [
      { month: 'Oct', words: 7200 },
      { month: 'Nov', words: 7840 },
      { month: 'Dec', words: 7810 },
      { month: 'Jan', words: 9630 },
      { month: 'Feb', words: 11210 },
      { month: 'Mar', words: 12840 }
    ],
    appUsage: [
      { app: 'Slack', words: 11340, fill: 'var(--color-chart-1)' },
      { app: 'Notion', words: 8620, fill: 'var(--color-chart-2)' },
      { app: 'Gmail', words: 7690, fill: 'var(--color-chart-3)' },
      { app: 'Linear', words: 6170, fill: 'var(--color-chart-4)' }
    ]
  },
  '12m': {
    summary: {
      averageWpm: 114,
      words: 102130,
      totalMinutes: 2360,
      sessions: 381
    },
    wordsTimeline: [
      { label: 'Apr', words: 6120 },
      { label: 'May', words: 6590 },
      { label: 'Jun', words: 7040 },
      { label: 'Jul', words: 7390 },
      { label: 'Aug', words: 7800 },
      { label: 'Sep', words: 8260 },
      { label: 'Oct', words: 9120 },
      { label: 'Nov', words: 9680 },
      { label: 'Dec', words: 10220 },
      { label: 'Jan', words: 11280 },
      { label: 'Feb', words: 12120 },
      { label: 'Mar', words: 13510 }
    ],
    wpmTimeline: [
      { label: 'Apr', wpm: 92, rolling: 92 },
      { label: 'May', wpm: 96, rolling: 94 },
      { label: 'Jun', wpm: 100, rolling: 96 },
      { label: 'Jul', wpm: 102, rolling: 97 },
      { label: 'Aug', wpm: 105, rolling: 99 },
      { label: 'Sep', wpm: 109, rolling: 101 },
      { label: 'Oct', wpm: 112, rolling: 103 },
      { label: 'Nov', wpm: 114, rolling: 105 },
      { label: 'Dec', wpm: 116, rolling: 107 },
      { label: 'Jan', wpm: 119, rolling: 109 },
      { label: 'Feb', wpm: 121, rolling: 112 },
      { label: 'Mar', wpm: 124, rolling: 114 }
    ],
    monthlyWords: [
      { month: 'Apr', words: 6120 },
      { month: 'May', words: 6590 },
      { month: 'Jun', words: 7040 },
      { month: 'Jul', words: 7390 },
      { month: 'Aug', words: 7800 },
      { month: 'Sep', words: 8260 },
      { month: 'Oct', words: 9120 },
      { month: 'Nov', words: 9680 },
      { month: 'Dec', words: 10220 },
      { month: 'Jan', words: 11280 },
      { month: 'Feb', words: 12120 },
      { month: 'Mar', words: 13510 }
    ],
    appUsage: [
      { app: 'Slack', words: 36040, fill: 'var(--color-chart-1)' },
      { app: 'Notion', words: 27220, fill: 'var(--color-chart-2)' },
      { app: 'Gmail', words: 20470, fill: 'var(--color-chart-3)' },
      { app: 'Linear', words: 18400, fill: 'var(--color-chart-4)' }
    ]
  }
}

const wpmChartConfig = {
  wpm: {
    label: 'Per-session WPM',
    color: 'var(--color-chart-1)'
  },
  rolling: {
    label: 'Trend line',
    color: 'var(--color-chart-3)'
  }
} satisfies ChartConfig

const monthlyChartConfig = {
  words: {
    label: 'Words',
    color: 'var(--color-chart-2)'
  }
} satisfies ChartConfig

const numberFormatter = new Intl.NumberFormat('en-US')
const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1
})

type AppDetailRow = {
  app: string
  words: number
  interactions: number
  averageWpm: number
}

type RecentSessionRow = {
  at: string
  words: number
  wpm: number
  durationMinutes: number
  app: string
}

const APP_DETAIL_EXTRAS: Array<{ app: string; words: number; interactions: number }> = [
  { app: 'Google Docs', words: 1120, interactions: 9 },
  { app: 'Figma', words: 760, interactions: 6 },
  { app: 'Jira', words: 540, interactions: 5 },
  { app: 'Terminal', words: 380, interactions: 4 }
]

const RANGE_DETAIL_SCALE: Record<HomeReportingRange, number> = {
  '7d': 0.35,
  '30d': 1,
  '90d': 2.3,
  '12m': 7.6
}

const CHART_APP_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)'
] as const

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

function buildAppDetails(range: HomeReportingRange, data: HomeRangeMockData): AppDetailRow[] {
  const primaryRows = data.appUsage.map((item, index) => ({
    app: item.app,
    words: item.words,
    interactions: Math.max(4, Math.round(item.words / 230)),
    averageWpm: Math.round(data.summary.averageWpm + (index - 1) * 2.5)
  }))

  const extras = APP_DETAIL_EXTRAS.map((item, index) => ({
    app: item.app,
    words: Math.round(item.words * RANGE_DETAIL_SCALE[range]),
    interactions: Math.max(2, Math.round(item.interactions * RANGE_DETAIL_SCALE[range])),
    averageWpm: Math.round(data.summary.averageWpm - 6 + index * 2)
  }))

  return [...primaryRows, ...extras].sort((a, b) => b.words - a.words)
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

  const activeData = MOCK_RANGE_DATA[selectedRange]
  const appDetails = useMemo(
    () => buildAppDetails(selectedRange, activeData),
    [selectedRange, activeData]
  )
  const topApps = useMemo(
    () =>
      appDetails.slice(0, 5).map((row, index) => ({
        app: row.app,
        words: row.words,
        fill: CHART_APP_COLORS[index] ?? CHART_APP_COLORS[CHART_APP_COLORS.length - 1]
      })),
    [appDetails]
  )
  const topAppsWordsTotal = useMemo(
    () => topApps.reduce((total, row) => total + row.words, 0),
    [topApps]
  )
  const recentSessions = useMemo(() => RECENT_SESSIONS_BY_RANGE[selectedRange], [selectedRange])
  const appDetailsTotal = useMemo(
    () => appDetails.reduce((total, row) => total + row.words, 0),
    [appDetails]
  )

  const appUsageChartConfig = useMemo(() => {
    const config: ChartConfig = {}

    topApps.forEach((item) => {
      config[item.app] = {
        label: item.app,
        color: item.fill
      }
    })

    return config
  }, [topApps])

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
              <Card className="bg-card/95 ring-foreground/8">
                <CardHeader className="border-border/50 border-b">
                  <CardTitle>WPM trend</CardTitle>
                  <CardDescription>Session speed with smoothed trend.</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <ChartContainer config={wpmChartConfig} className="h-56 w-full aspect-auto">
                    <LineChart
                      data={activeData.wpmTimeline}
                      margin={{ left: 12, right: 12, top: 8 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        minTickGap={18}
                      />
                      <YAxis tickLine={false} axisLine={false} width={32} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="rolling"
                        stroke="var(--color-rolling)"
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="4 4"
                      />
                      <Line
                        type="monotone"
                        dataKey="wpm"
                        stroke="var(--color-wpm)"
                        strokeWidth={2.2}
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Raw shows each session. Trend smooths short-term spikes.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/95 ring-foreground/8">
                <CardHeader className="border-border/50 border-b">
                  <CardTitle>Monthly output</CardTitle>
                  <CardDescription>Words by month.</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <ChartContainer config={monthlyChartConfig} className="h-56 w-full aspect-auto">
                    <BarChart
                      data={activeData.monthlyWords}
                      margin={{ left: 12, right: 12, top: 8 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={42}
                        tickFormatter={(value) => compactFormatter.format(value)}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="words" radius={[6, 6, 0, 0]} fill="var(--color-words)" />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="bg-card/95 ring-foreground/8">
                <CardHeader className="border-border/50 border-b">
                  <Sheet>
                    <CardAction>
                      <SheetTrigger render={<Button variant="outline" size="sm" />}>
                        All apps
                      </SheetTrigger>
                    </CardAction>
                    <SheetContent side="right">
                      <SheetHeader>
                        <SheetTitle>All apps</SheetTitle>
                        <SheetDescription>Full breakdown for selected range.</SheetDescription>
                      </SheetHeader>

                      <div className="app-scroll-area flex-1 overflow-y-auto px-4 pb-4">
                        <div className="space-y-2">
                          {appDetails.map((row) => {
                            const share =
                              appDetailsTotal > 0 ? (row.words / appDetailsTotal) * 100 : 0

                            return (
                              <div
                                key={row.app}
                                className="border-border/60 bg-background/60 rounded-lg border px-3 py-2.5"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-medium">{row.app}</p>
                                    <p className="text-muted-foreground text-xs">
                                      {row.interactions} interactions
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-medium">
                                      {numberFormatter.format(row.words)}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                      {share.toFixed(1)}% share
                                    </p>
                                  </div>
                                </div>
                                <p className="text-muted-foreground mt-1 text-xs">
                                  Avg WPM in this app: {numberFormatter.format(row.averageWpm)}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                  <CardTitle>Top apps</CardTitle>
                  <CardDescription>Top 5 apps by word count.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 pt-4 sm:grid-cols-[auto_1fr] sm:items-center">
                  <ChartContainer
                    config={appUsageChartConfig}
                    className="mx-auto h-44 w-44 aspect-auto"
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <Pie
                        data={topApps}
                        dataKey="words"
                        nameKey="app"
                        innerRadius={46}
                        outerRadius={70}
                        paddingAngle={3}
                        strokeWidth={2}
                      >
                        {topApps.map((item) => (
                          <Cell key={item.app} fill={item.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>

                  <div className="space-y-2">
                    {topApps.map((item) => {
                      const share =
                        topAppsWordsTotal > 0 ? (item.words / topAppsWordsTotal) * 100 : 0

                      return (
                        <div
                          key={item.app}
                          className="border-border/60 bg-background/60 flex items-center justify-between rounded-lg border px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: item.fill }}
                              aria-hidden
                            />
                            <span className="text-sm font-medium">{item.app}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {numberFormatter.format(item.words)}
                            </p>
                            <p className="text-muted-foreground text-xs">{share.toFixed(1)}%</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

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
