import { useSearch } from '@tanstack/react-router'
import { TRANSCRIPTS_PAGE_SIZE } from '../../../../shared/storage'

export function TranscriptsView(): React.JSX.Element {
  const { page } = useSearch({ from: '/transcripts' })

  return (
    <section className="w-full max-w-4xl space-y-5 py-1 sm:py-2">
      <header className="space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Transcripts</h2>
        <p className="text-muted-foreground text-sm">
          Transcript list UI is coming next. Backend pagination is ready with page size{' '}
          {TRANSCRIPTS_PAGE_SIZE}.
        </p>
      </header>

      <p className="text-muted-foreground text-sm">Current page: {page}</p>
    </section>
  )
}
