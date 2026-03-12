import { TRANSCRIPTS_COPY } from '../constants/copy'
import { formatTranscriptCount } from '../helpers/transcript-formatters'

type TranscriptsHeaderProps = {
  totalItems: number
}

export function TranscriptsHeader({ totalItems }: TranscriptsHeaderProps): React.JSX.Element {
  return (
    <header className="space-y-1.5">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
        {TRANSCRIPTS_COPY.header.title}
      </h2>
      <p className="text-muted-foreground text-sm">{TRANSCRIPTS_COPY.header.description}</p>
      <p className="text-muted-foreground text-xs">{formatTranscriptCount(totalItems)}</p>
    </header>
  )
}
