import { Accordion } from '@renderer/ui/accordion'
import type { TranscriptsListItem } from '../queries/transcripts/transcripts.types'
import { TranscriptAccordionItem } from './transcript-accordion-item'

type TranscriptsListProps = {
  items: TranscriptsListItem[]
}

export function TranscriptsList({ items }: TranscriptsListProps): React.JSX.Element {
  return (
    <Accordion className="space-y-2">
      {items.map((item) => (
        <TranscriptAccordionItem key={item.transcriptId} item={item} />
      ))}
    </Accordion>
  )
}
