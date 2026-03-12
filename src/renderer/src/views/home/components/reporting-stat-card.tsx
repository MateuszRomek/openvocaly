import { Badge } from '@renderer/ui/badge'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@renderer/ui/card'
import { formatDeltaPercent, resolveDeltaVariant } from '../helpers/reporting-summary-formatters'

export type ReportingStatCardProps = {
  title: string
  value: string
  description: string
  percentage?: number | null
}

export function ReportingStatCard({
  title,
  value,
  description,
  percentage
}: ReportingStatCardProps): React.JSX.Element {
  return (
    <Card className="bg-card/90 ring-foreground/8">
      <CardHeader className="gap-2">
        {typeof percentage === 'number' ? (
          <CardAction>
            <Badge variant={resolveDeltaVariant(percentage)}>
              {formatDeltaPercent(percentage)}
            </Badge>
          </CardAction>
        ) : null}
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl tracking-tight">{value}</CardTitle>
        <p className="text-muted-foreground text-xs">{description}</p>
      </CardHeader>
    </Card>
  )
}
