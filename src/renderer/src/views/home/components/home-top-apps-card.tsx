import { useMemo } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@renderer/ui/chart'
import type { HomeReportingRange } from '../constants/reporting-range'
import { useHomeTopApps } from '../hooks/use-home-top-apps'
import { HomeTopAppsEmptyState } from './home-top-apps-empty-state'
import { HomeTopAppsSheet } from './home-top-apps-sheet'

type HomeTopAppsCardProps = {
  range: HomeReportingRange
}

const wordsFormatter = new Intl.NumberFormat('en-US')

export function HomeTopAppsCard({ range }: HomeTopAppsCardProps): React.JSX.Element {
  const { topApps, appDetails, hasActivity } = useHomeTopApps(range)

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {}

    topApps.forEach((item) => {
      config[item.appKey] = {
        label: item.appLabel,
        color: item.fill
      }
    })

    return config
  }, [topApps])

  return (
    <Card className="bg-card/95 ring-foreground/8">
      <CardHeader className="border-border/50 border-b">
        {hasActivity ? <HomeTopAppsSheet appDetails={appDetails} /> : null}
        <CardTitle>Top apps</CardTitle>
        <CardDescription>Top 5 apps by word count.</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {hasActivity ? (
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <ChartContainer config={chartConfig} className="mx-auto h-44 w-44 aspect-auto">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={topApps}
                  dataKey="words"
                  nameKey="appLabel"
                  innerRadius={46}
                  outerRadius={70}
                  paddingAngle={3}
                  strokeWidth={2}
                >
                  {topApps.map((item) => (
                    <Cell key={item.appKey} fill={item.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="space-y-2">
              {topApps.map((item) => (
                <div
                  key={item.appKey}
                  className="border-border/60 bg-background/60 flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.fill }}
                      aria-hidden
                    />
                    <span className="text-sm font-medium">{item.appLabel}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{wordsFormatter.format(item.words)}</p>
                    <p className="text-muted-foreground text-xs">{item.sharePct.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <HomeTopAppsEmptyState />
        )}
      </CardContent>
    </Card>
  )
}
