import { Skeleton } from '@renderer/ui/skeleton'
import { Card, CardHeader } from '@renderer/ui/card'

export function HomeReportingSummaryRowSkeleton(): React.JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="bg-card/90 ring-foreground/8">
          <CardHeader className="gap-2">
            <div className="flex justify-end">
              <Skeleton className="h-5 w-16 rounded-4xl" />
            </div>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3.5 w-32" />
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
