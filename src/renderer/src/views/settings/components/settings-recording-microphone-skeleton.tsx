import { Skeleton } from '@renderer/ui/skeleton'
import { SectionCard } from '@renderer/components/section-card'

export function SettingsRecordingMicrophoneSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-28" />
      <SectionCard>
        <article className="px-5 py-5">
          <div className="flex min-h-[7rem] flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-3">
            <div className="min-w-0 flex-1 space-y-2.5">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-5 w-[32rem] max-w-full" />
              <Skeleton className="h-5 w-[24rem] max-w-full" />
            </div>
            <div className="flex w-full justify-start sm:w-auto sm:justify-end">
              <Skeleton className="h-9 w-64 rounded-md" />
            </div>
          </div>
        </article>
      </SectionCard>
    </div>
  )
}
