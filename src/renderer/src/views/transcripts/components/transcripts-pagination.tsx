import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@renderer/ui/button'
import { TRANSCRIPTS_COPY } from '../constants/copy'

type TranscriptsPaginationProps = {
  pageLabel: string
  canGoPrev: boolean
  canGoNext: boolean
  isPageTransitioning: boolean
  onPrevious: () => void
  onNext: () => void
}

export function TranscriptsPagination({
  pageLabel,
  canGoPrev,
  canGoNext,
  isPageTransitioning,
  onPrevious,
  onNext
}: TranscriptsPaginationProps): React.JSX.Element {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {canGoPrev ? (
          <Button type="button" variant="outline" size="sm" onClick={onPrevious}>
            <ChevronLeftIcon className="size-3.5" />
            {TRANSCRIPTS_COPY.pagination.previous}
          </Button>
        ) : (
          <div className="h-7 w-24" aria-hidden />
        )}

        <p className="text-muted-foreground text-xs font-medium">{pageLabel}</p>

        {canGoNext ? (
          <Button type="button" variant="outline" size="sm" onClick={onNext}>
            {TRANSCRIPTS_COPY.pagination.next}
            <ChevronRightIcon className="size-3.5" />
          </Button>
        ) : (
          <div className="h-7 w-24" aria-hidden />
        )}
      </div>

      {isPageTransitioning ? (
        <p className="text-muted-foreground text-right text-xs">
          {TRANSCRIPTS_COPY.pagination.updating}
        </p>
      ) : null}
    </section>
  )
}
