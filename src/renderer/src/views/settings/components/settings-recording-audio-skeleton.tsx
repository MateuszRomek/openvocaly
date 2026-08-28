import { Skeleton } from '@renderer/ui/skeleton'
import { SectionCard } from '@renderer/components/section-card'

export function SettingsRecordingAudioSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-32" />
      <SectionCard>
        <article className="px-5 py-5">
          <div className="flex min-h-[7rem] flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-3">
            <div className="min-w-0 flex-1 space-y-2.5">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-5 w-[30rem] max-w-full" />
              <Skeleton className="h-5 w-[24rem] max-w-full" />
            </div>
            <div className="flex w-full items-center gap-4 sm:w-auto sm:justify-end">
              <Skeleton className="h-3 w-44 sm:w-48" />
              <Skeleton className="h-7 w-12 rounded-full" />
            </div>
          </div>
        </article>
      </SectionCard>
    </div>
  )
}
