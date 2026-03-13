import { useCallback, useMemo } from 'react'
import { TRANSCRIPTS_PAGE_SIZE_FALLBACK } from '../constants/transcripts'
import { useTranscriptsListQuery } from '../queries/transcripts/use-transcripts-list-query'
import type { TranscriptsListItem } from '../queries/transcripts/transcripts.types'
import { useTranscriptsPage } from './use-transcripts-page'

export type UsePaginatedTranscriptsResult = {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  pageLabel: string
  items: TranscriptsListItem[]
  isInitialLoading: boolean
  isPageTransitioning: boolean
  isEmpty: boolean
  isOutOfRangeEmpty: boolean
  isError: boolean
  canGoPrev: boolean
  canGoNext: boolean
  goToPreviousPage: () => void
  goToNextPage: () => void
  goToLastPage: () => void
  retry: () => void
}

export function usePaginatedTranscripts(): UsePaginatedTranscriptsResult {
  const { page, isNavigating, setPage, goToPreviousPage, goToNextPage } = useTranscriptsPage()
  const transcriptsQuery = useTranscriptsListQuery(page)

  const retry = useCallback((): void => {
    void transcriptsQuery.refetch()
  }, [transcriptsQuery])

  const {
    items,
    pageSize,
    totalItems,
    totalPages,
    pageLabel,
    isInitialLoading,
    isPageTransitioning,
    isEmpty,
    isOutOfRangeEmpty,
    canGoPrev,
    canGoNext
  } = useMemo(() => {
    const data = transcriptsQuery.data
    const nextItems = data?.items ?? []
    const nextPageSize = data?.pageSize ?? TRANSCRIPTS_PAGE_SIZE_FALLBACK
    const nextTotalItems = data?.totalItems ?? 0
    const nextTotalPages = data?.totalPages ?? 0

    const nextIsInitialLoading = transcriptsQuery.isPending && !data
    const nextIsPageTransitioning =
      transcriptsQuery.isFetching && transcriptsQuery.isPlaceholderData

    const nextIsEmpty = !nextIsInitialLoading && nextTotalItems === 0
    const nextIsOutOfRangeEmpty =
      !nextIsInitialLoading && nextTotalItems > 0 && nextItems.length === 0 && page > nextTotalPages

    const nextCanGoPrev = page > 1 && !nextIsPageTransitioning && !isNavigating
    const nextCanGoNext =
      Boolean(data?.hasNextPage) && !nextIsPageTransitioning && !transcriptsQuery.isPlaceholderData

    const nextPageLabel = nextTotalPages > 0 ? `Page ${page} of ${nextTotalPages}` : `Page ${page}`

    return {
      items: nextItems,
      pageSize: nextPageSize,
      totalItems: nextTotalItems,
      totalPages: nextTotalPages,
      pageLabel: nextPageLabel,
      isInitialLoading: nextIsInitialLoading,
      isPageTransitioning: nextIsPageTransitioning,
      isEmpty: nextIsEmpty,
      isOutOfRangeEmpty: nextIsOutOfRangeEmpty,
      canGoPrev: nextCanGoPrev,
      canGoNext: nextCanGoNext
    }
  }, [
    isNavigating,
    page,
    transcriptsQuery.data,
    transcriptsQuery.isPending,
    transcriptsQuery.isFetching,
    transcriptsQuery.isPlaceholderData
  ])

  const goToLastPage = useCallback((): void => {
    setPage(Math.max(1, totalPages))
  }, [setPage, totalPages])

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    pageLabel,
    items,
    isInitialLoading,
    isPageTransitioning,
    isEmpty,
    isOutOfRangeEmpty,
    isError: transcriptsQuery.isError,
    canGoPrev,
    canGoNext,
    goToPreviousPage,
    goToNextPage,
    goToLastPage,
    retry
  }
}
