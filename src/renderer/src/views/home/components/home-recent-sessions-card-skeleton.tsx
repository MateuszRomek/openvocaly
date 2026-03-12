import { Card, CardContent, CardHeader } from '@renderer/ui/card'
import { Skeleton } from '@renderer/ui/skeleton'

export function HomeRecentSessionsCardSkeleton(): React.JSX.Element {
  return (
    <Card className="bg-card/95 ring-foreground/8">
      <CardHeader className="border-border/50 border-b">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="pt-4">
        <Skeleton className="h-8 w-full" />
        <div className="mt-2 space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}
