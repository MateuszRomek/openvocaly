import { createFileRoute } from '@tanstack/react-router'
import { TRANSCRIPTS_PAGE_SIZE } from '../../../shared/storage'
import { TranscriptsView } from '@renderer/views/transcripts'

const MAX_TRANSCRIPTS_PAGE = Math.floor(Number.MAX_SAFE_INTEGER / TRANSCRIPTS_PAGE_SIZE)

const normalizePageSearch = (value: unknown): number => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_TRANSCRIPTS_PAGE) {
    return 1
  }

  return parsed
}

export const Route = createFileRoute('/transcripts')({
  validateSearch: (
    search: Record<string, unknown>
  ): {
    page: number
  } => ({
    page: normalizePageSearch(search.page)
  }),
  component: TranscriptsView
})
