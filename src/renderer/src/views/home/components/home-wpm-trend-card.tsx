import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@renderer/ui/chart'
import type { HomeReportingRange } from '../constants/reporting-range'
import { useHomeWpmTrendChart } from '../hooks/use-home-wpm-trend-chart'
import { HomeWpmTrendEmptyState } from './home-wpm-trend-empty-state'

type HomeWpmTrendCardProps = {
  range: HomeReportingRange
}

const wpmChartConfig = {
  wpm: {
    label: 'Per-session WPM',
    color: 'var(--color-chart-1)'
  },
  trend: {
    label: 'Trend line',
    color: 'var(--color-chart-3)'
  }
} satisfies ChartConfig

export function HomeWpmTrendCard({ range }: HomeWpmTrendCardProps): React.JSX.Element {
  const { points, hasWpmData, showTrendline } = useHomeWpmTrendChart(range)

  return (
    <Card className="bg-card/95 ring-foreground/8">
      <CardHeader className="border-border/50 border-b">
        <CardTitle>WPM trend</CardTitle>
        <CardDescription>Session speed with smoothed trend.</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {hasWpmData ? (
          <>
            <ChartContainer config={wpmChartConfig} className="h-56 w-full aspect-auto">
              <LineChart data={points} margin={{ left: 12, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={18}
                />
                <YAxis tickLine={false} axisLine={false} width={36} />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                {showTrendline ? (
                  <Line
                    type="monotone"
                    dataKey="trend"
                    stroke="var(--color-trend)"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="4 4"
                    connectNulls={false}
                  />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="wpm"
                  stroke="var(--color-wpm)"
                  strokeWidth={2.2}
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ChartContainer>
            <p className="text-muted-foreground mt-2 text-xs">
              Solid line shows each session. Dashed line shows the smoothed trend.
            </p>
          </>
        ) : (
          <HomeWpmTrendEmptyState />
        )}
      </CardContent>
    </Card>
  )
}
