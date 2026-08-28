import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  CardAction,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@renderer/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@renderer/ui/chart'
import { Tabs, TabsList, TabsTrigger } from '@renderer/ui/tabs'
import {
  type HomeMonthlyTimeWindow,
  useHomeMonthlyOutputChart
} from '../hooks/use-home-monthly-output-chart'
import { HomeMonthlyOutputEmptyState } from './home-monthly-output-empty-state'

const monthlyOutputChartConfig = {
  words: {
    label: 'Words',
    color: 'var(--color-chart-2)'
  }
} satisfies ChartConfig

const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1
})

const HOME_MONTHLY_TIME_WINDOW_LABELS: Record<HomeMonthlyTimeWindow, string> = {
  '6m': '6 months',
  '12m': '12 months'
}

const HOME_MONTHLY_TIME_WINDOW_VALUES = [
  '6m',
  '12m'
] as const satisfies readonly HomeMonthlyTimeWindow[]

export function HomeMonthlyOutputCard(): React.JSX.Element {
  const [timeWindow, setTimeWindow] = useState<HomeMonthlyTimeWindow>('6m')
  const { points, hasActivity } = useHomeMonthlyOutputChart(timeWindow)

  return (
    <Card className="bg-card/95 ring-foreground/8">
      <CardHeader className="border-border/50 border-b">
        <CardAction>
          <Tabs
            value={timeWindow}
            onValueChange={(nextValue) => setTimeWindow(nextValue as HomeMonthlyTimeWindow)}
          >
            <TabsList className="bg-muted/80 h-8">
              {HOME_MONTHLY_TIME_WINDOW_VALUES.map((value) => (
                <TabsTrigger key={value} value={value} className="text-xs">
                  {HOME_MONTHLY_TIME_WINDOW_LABELS[value]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardAction>
        <CardTitle>Monthly Output</CardTitle>
        <CardDescription>Words by month.</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {hasActivity ? (
          <ChartContainer
            config={monthlyOutputChartConfig}
            className="h-56 w-full aspect-auto"
            role="img"
            aria-label="Bar chart showing words dictated by month."
          >
            <BarChart data={points} margin={{ left: 12, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
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
        ) : (
          <HomeMonthlyOutputEmptyState />
        )}
      </CardContent>
    </Card>
  )
}
