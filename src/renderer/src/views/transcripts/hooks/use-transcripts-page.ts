import { useCallback, useTransition } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'

type UseTranscriptsPageResult = {
  page: number
  isNavigating: boolean
  setPage: (nextPage: number) => void
  goToPreviousPage: () => void
  goToNextPage: () => void
}

export function useTranscriptsPage(): UseTranscriptsPageResult {
  const { page } = useSearch({ from: '/transcripts' })
  const navigate = useNavigate({ from: '/transcripts' })
  const [isNavigating, startTransition] = useTransition()

  const setPage = useCallback(
    (nextPage: number): void => {
      const normalizedPage = Math.max(1, Math.floor(nextPage))

      if (normalizedPage === page) {
        return
      }

      startTransition(() => {
        void navigate({
          search: (previous) => ({
            ...previous,
            page: normalizedPage
          })
        })
      })
    },
    [navigate, page, startTransition]
  )

  const goToPreviousPage = useCallback((): void => {
    setPage(page - 1)
  }, [page, setPage])

  const goToNextPage = useCallback((): void => {
    setPage(page + 1)
  }, [page, setPage])

  return {
    page,
    isNavigating,
    setPage,
    goToPreviousPage,
    goToNextPage
  }
}
