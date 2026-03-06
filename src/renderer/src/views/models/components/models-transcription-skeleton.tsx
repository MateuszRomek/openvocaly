import type { JSX } from 'react'
import { Skeleton } from '@renderer/ui/skeleton'
import { SectionCard } from '@renderer/components/section-card'

export function ModelsTranscriptionSkeleton(): JSX.Element {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-36" />
      <SectionCard>
        <article className="space-y-4 px-5 py-5">
          <div className="flex min-h-[12rem] flex-col items-start gap-4 sm:flex-row sm:items-start sm:gap-3">
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-5 w-[30rem] max-w-full" />
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-8 w-64" />
            </div>
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-8 w-80 max-w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </article>
      </SectionCard>
    </div>
  )
}
