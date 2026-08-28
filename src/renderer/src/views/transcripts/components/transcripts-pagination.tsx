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
    <nav
      aria-label={TRANSCRIPTS_COPY.pagination.label}
      className="space-y-2 border-t border-border/70 pt-4"
    >
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={!canGoPrev}
          aria-label={TRANSCRIPTS_COPY.pagination.previous}
        >
          <ChevronLeftIcon aria-hidden="true" className="size-3.5" />
          {TRANSCRIPTS_COPY.pagination.previous}
        </Button>

        <p aria-live="polite" className="text-muted-foreground text-xs font-medium">
          {pageLabel}
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!canGoNext}
          aria-label={TRANSCRIPTS_COPY.pagination.next}
        >
          {TRANSCRIPTS_COPY.pagination.next}
          <ChevronRightIcon aria-hidden="true" className="size-3.5" />
        </Button>
      </div>

      {isPageTransitioning ? (
        <p role="status" className="text-muted-foreground text-right text-xs">
          {TRANSCRIPTS_COPY.pagination.updating}
        </p>
      ) : null}
    </nav>
  )
}
