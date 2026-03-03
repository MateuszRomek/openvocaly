import { Skeleton } from '@renderer/ui/skeleton'
import { SectionCard } from '@renderer/components/section-card'

export function SettingsPermissionsSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-28" />
      <SectionCard>
        {Array.from({ length: 2 }).map((_, index) => (
          <article
            key={index}
            className={`flex min-h-[6.5rem] items-center gap-3 px-5 py-5 ${
              index === 1 ? '' : 'border-border border-b'
            }`}
          >
            <div className="min-w-0 flex-1 space-y-2.5">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-5 w-[28rem] max-w-full" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
            <div className="flex shrink-0 gap-2">
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </article>
        ))}
      </SectionCard>
    </div>
  )
}
