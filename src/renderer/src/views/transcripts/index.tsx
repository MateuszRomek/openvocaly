import { TranscriptsEmptyState } from './components/transcripts-empty-state'
import { TranscriptsErrorState } from './components/transcripts-error-state'
import { TranscriptsHeader } from './components/transcripts-header'
import { TranscriptsList } from './components/transcripts-list'
import { TranscriptsListSkeleton } from './components/transcripts-list-skeleton'
import { TranscriptsPagination } from './components/transcripts-pagination'
import { usePaginatedTranscripts } from './hooks/use-paginated-transcripts'

export function TranscriptsView(): React.JSX.Element {
  const {
    totalItems,
    totalPages,
    pageLabel,
    items,
    isInitialLoading,
    isPageTransitioning,
    isEmpty,
    isOutOfRangeEmpty,
    isError,
    canGoPrev,
    canGoNext,
    goToPreviousPage,
    goToNextPage,
    goToLastPage,
    retry
  } = usePaginatedTranscripts()

  const hasPagination = totalPages > 1 && !isError
  const showError = isError
  const showSkeleton = !showError && isInitialLoading
  const showEmpty = !showError && !showSkeleton && (isEmpty || isOutOfRangeEmpty)
  const showList = !showError && !showSkeleton && !showEmpty

  return (
    <section className="w-full max-w-4xl space-y-5 py-1 sm:py-2">
      <TranscriptsHeader totalItems={totalItems} />

      {showError && <TranscriptsErrorState onRetry={retry} />}
      {showSkeleton && <TranscriptsListSkeleton />}
      {showEmpty && (
        <TranscriptsEmptyState isOutOfRange={isOutOfRangeEmpty} onGoToLastPage={goToLastPage} />
      )}
      {showList && <TranscriptsList items={items} />}

      {hasPagination && (
        <TranscriptsPagination
          pageLabel={pageLabel}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          isPageTransitioning={isPageTransitioning}
          onPrevious={goToPreviousPage}
          onNext={goToNextPage}
        />
      )}
    </section>
  )
}
