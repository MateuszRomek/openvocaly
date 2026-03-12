import { Card, CardContent, CardHeader } from '@renderer/ui/card'
import { Skeleton } from '@renderer/ui/skeleton'

export function HomeMonthlyOutputCardSkeleton(): React.JSX.Element {
  return (
    <Card className="bg-card/95 ring-foreground/8">
      <CardHeader className="border-border/50 border-b">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="pt-4">
        <Skeleton className="h-56 w-full" />
      </CardContent>
    </Card>
  )
}
