import { TRANSCRIPTS_COPY } from '../constants/copy'
import { formatTranscriptCount } from '../helpers/transcript-formatters'

type TranscriptsHeaderProps = {
  totalItems: number
}

export function TranscriptsHeader({ totalItems }: TranscriptsHeaderProps): React.JSX.Element {
  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-2xl text-balance font-semibold tracking-tight sm:text-3xl">
          {TRANSCRIPTS_COPY.header.title}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          {TRANSCRIPTS_COPY.header.description}
        </p>
      </div>
      <p className="text-muted-foreground text-xs font-medium tabular-nums sm:shrink-0">
        {formatTranscriptCount(totalItems)}
      </p>
    </header>
  )
}
