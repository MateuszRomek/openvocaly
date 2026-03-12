import { Card, CardContent, CardHeader } from '@renderer/ui/card'
import { Skeleton } from '@renderer/ui/skeleton'

export function HomeTopAppsCardSkeleton(): React.JSX.Element {
  return (
    <Card className="bg-card/95 ring-foreground/8">
      <CardHeader className="border-border/50 border-b">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent className="grid gap-4 pt-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <Skeleton className="mx-auto h-44 w-44 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}
