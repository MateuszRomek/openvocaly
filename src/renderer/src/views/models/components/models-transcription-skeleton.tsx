import type { JSX } from 'react'
import { SectionCard } from '@renderer/components/section-card'
import { Skeleton } from '@renderer/ui/skeleton'

export function ModelsTranscriptionSkeleton(): JSX.Element {
  return (
    <div role="status" aria-label="Loading local transcription models" className="space-y-3">
      <SectionCard>
        <div className="border-border/70 flex items-center justify-between border-b bg-muted/30 px-5 py-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
        <article className="space-y-3 px-5 py-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-8 w-24" />
        </article>
      </SectionCard>
    </div>
  )
}
