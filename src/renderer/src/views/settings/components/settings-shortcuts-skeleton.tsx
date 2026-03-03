import { Skeleton } from '@renderer/ui/skeleton'

type SettingsShortcutsSkeletonProps = {
  rows?: number
}

export function SettingsShortcutsSkeleton({
  rows = 2
}: SettingsShortcutsSkeletonProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-28" />
      <div className="border-border/45 bg-card/28 overflow-hidden rounded-2xl border backdrop-blur-sm">
        {Array.from({ length: rows }).map((_, index) => (
          <article
            key={index}
            className={`flex min-h-[7.5rem] items-center gap-3 px-5 py-5 ${
              index === rows - 1 ? '' : 'border-border border-b'
            }`}
          >
            <div className="min-w-0 flex-1 space-y-2.5">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-5 w-[28rem] max-w-full" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
            <div className="w-[11rem] shrink-0 space-y-2">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="mx-auto h-4 w-32" />
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
