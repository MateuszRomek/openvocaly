import type { TranscriptsListItem } from '../queries/transcripts/transcripts.types'
import { Accordion } from '@renderer/ui/accordion'
import {
  formatTranscriptDateGroup,
  formatTranscriptDateKey
} from '../helpers/transcript-formatters'
import { TranscriptListItem } from './transcript-list-item'

type TranscriptsListProps = {
  items: TranscriptsListItem[]
}

export function TranscriptsList({ items }: TranscriptsListProps): React.JSX.Element {
  const groups: Array<{ key: string; label: string; items: TranscriptsListItem[] }> = []

  for (const item of items) {
    const key = formatTranscriptDateKey(item.createdAt)
    const currentGroup = groups.at(-1)

    if (currentGroup?.key === key) {
      currentGroup.items.push(item)
      continue
    }

    groups.push({
      key,
      label: formatTranscriptDateGroup(item.createdAt),
      items: [item]
    })
  }

  return (
    <div id="transcript-list" role="region" aria-label="Transcript history" className="space-y-8">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`transcript-group-${group.key}`}>
          <div className="mb-3 flex items-center gap-3 px-1">
            <h3
              id={`transcript-group-${group.key}`}
              className="text-foreground text-sm font-semibold tracking-tight"
            >
              {group.label}
            </h3>
            <span className="text-muted-foreground text-xs tabular-nums">{group.items.length}</span>
            <span className="h-px flex-1 bg-border/70" aria-hidden="true" />
          </div>

          <Accordion className="border-border/70 bg-card/45 divide-border/70 min-w-0">
            {group.items.map((item) => (
              <TranscriptListItem key={item.transcriptId} item={item} />
            ))}
          </Accordion>
        </section>
      ))}
    </div>
  )
}
