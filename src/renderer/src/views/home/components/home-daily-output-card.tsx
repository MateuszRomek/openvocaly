import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@renderer/ui/chart'
import type { HomeReportingRange } from '../constants/reporting-range'
import { useHomeDailyOutputChart } from '../hooks/use-home-daily-output-chart'
import { HomeDailyOutputEmptyState } from './home-daily-output-empty-state'

type HomeDailyOutputCardProps = {
  range: HomeReportingRange
}

const dailyOutputChartConfig = {
  words: {
    label: 'Words',
    color: 'var(--color-chart-1)'
  }
} satisfies ChartConfig

const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1
})

export function HomeDailyOutputCard({ range }: HomeDailyOutputCardProps): React.JSX.Element {
  const { points, hasActivity } = useHomeDailyOutputChart(range)

  return (
    <Card className="bg-card/95 ring-foreground/8">
      <CardHeader className="border-border/50 border-b">
        <CardTitle>Daily output</CardTitle>
        <CardDescription>Words dictated each day.</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {hasActivity ? (
          <ChartContainer config={dailyOutputChartConfig} className="h-64 w-full aspect-auto">
            <AreaChart data={points} margin={{ left: 12, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={18}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={42}
                tickFormatter={(value) => compactFormatter.format(value)}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="words"
                stroke="var(--color-words)"
                fill="var(--color-words)"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <HomeDailyOutputEmptyState />
        )}
      </CardContent>
    </Card>
  )
}
