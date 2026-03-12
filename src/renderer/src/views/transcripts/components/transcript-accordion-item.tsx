import { useCallback } from 'react'
import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@renderer/ui/button'
import { Badge } from '@renderer/ui/badge'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@renderer/ui/accordion'
import { TRANSCRIPTS_COPY } from '../constants/copy'
import {
  formatTranscriptDuration,
  formatTranscriptTimestamp,
  resolveTranscriptAppLabel
} from '../helpers/transcript-formatters'
import type { TranscriptsListItem } from '../queries/transcripts/transcripts.types'

type TranscriptAccordionItemProps = {
  item: TranscriptsListItem
}

export function TranscriptAccordionItem({ item }: TranscriptAccordionItemProps): React.JSX.Element {
  const handleCopy = useCallback((): void => {
    void (async (): Promise<void> => {
      try {
        await navigator.clipboard.writeText(item.text)
        toast.success(TRANSCRIPTS_COPY.actions.copied)
      } catch {
        toast.error(TRANSCRIPTS_COPY.errors.copy)
      }
    })()
  }, [item.text])

  const appLabel = resolveTranscriptAppLabel(item.targetAppName, item.targetAppIdentifier)

  return (
    <AccordionItem
      value={`transcript-${item.transcriptId}`}
      className="border-border/70 bg-card/95 rounded-xl border px-3 py-1 ring-1 ring-foreground/8"
    >
      <AccordionTrigger className="hover:no-underline">
        <div className="flex w-full min-w-0 items-center justify-between gap-2 pr-2">
          <p className="text-sm font-medium">{formatTranscriptTimestamp(item.createdAt)}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              handleCopy()
            }}
          >
            <CopyIcon className="size-3.5" />
            {TRANSCRIPTS_COPY.actions.copy}
          </Button>
        </div>
      </AccordionTrigger>

      <AccordionContent>
        <div className="space-y-3 px-1 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="h-5 px-2 text-[11px]">
              {appLabel}
            </Badge>
            <Badge variant="secondary" className="h-5 px-2 text-[11px]">
              {formatTranscriptDuration(item.durationMs)}
            </Badge>
          </div>

          <p className="text-sm whitespace-pre-wrap break-words">{item.text}</p>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
