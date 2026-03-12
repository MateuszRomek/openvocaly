import {
  HOME_REPORTING_RANGE_LABELS,
  HOME_REPORTING_RANGE_VALUES,
  type HomeReportingRange
} from '../constants/reporting-range'
import { Tabs, TabsList, TabsTrigger } from '@renderer/ui/tabs'

type HomeReportingRangeTabsProps = {
  value: HomeReportingRange
  onChange: (range: HomeReportingRange) => void
}

export function HomeReportingRangeTabs({
  value,
  onChange
}: HomeReportingRangeTabsProps): React.JSX.Element {
  return (
    <Tabs value={value} onValueChange={(nextValue) => onChange(nextValue as HomeReportingRange)}>
      <TabsList className="bg-muted/80">
        {HOME_REPORTING_RANGE_VALUES.map((range) => (
          <TabsTrigger key={range} value={range}>
            {HOME_REPORTING_RANGE_LABELS[range]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
