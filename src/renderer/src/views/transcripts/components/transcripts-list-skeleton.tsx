import { Skeleton } from '@renderer/ui/skeleton'

export function TranscriptsListSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-2">
      <div className="border-border/70 bg-card/95 rounded-xl border p-4 ring-1 ring-foreground/8">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-4 w-32" />
        <Skeleton className="mt-2 h-4 w-full" />
      </div>
      <div className="border-border/70 bg-card/95 rounded-xl border p-4 ring-1 ring-foreground/8">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-2 h-4 w-36" />
        <Skeleton className="mt-2 h-4 w-11/12" />
      </div>
      <div className="border-border/70 bg-card/95 rounded-xl border p-4 ring-1 ring-foreground/8">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-2 h-4 w-28" />
        <Skeleton className="mt-2 h-4 w-10/12" />
      </div>
    </div>
  )
}
