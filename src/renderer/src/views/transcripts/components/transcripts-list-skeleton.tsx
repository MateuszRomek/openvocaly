import { Skeleton } from '@renderer/ui/skeleton'

export function TranscriptsListSkeleton(): React.JSX.Element {
  return (
    <div
      role="status"
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading transcript history"
    >
      <div className="space-y-2.5">
        <Skeleton className="h-3 w-16" />
        <div className="space-y-2">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="border-border/70 bg-card/80 rounded-2xl border p-4 ring-1 ring-foreground/6"
            >
              <div className="flex gap-4">
                <Skeleton className="h-5 w-12 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-5 w-2/5" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
