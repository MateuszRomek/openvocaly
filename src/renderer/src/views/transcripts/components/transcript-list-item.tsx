import { useCallback } from 'react'
import { AppWindowIcon, ChevronRightIcon, CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@renderer/ui/button'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@renderer/ui/accordion'
import { TRANSCRIPTS_COPY } from '../constants/copy'
import {
  formatTranscriptDuration,
  formatTranscriptPreview,
  formatTranscriptTime,
  resolveTranscriptAppLabel
} from '../helpers/transcript-formatters'
import type { TranscriptsListItem } from '../queries/transcripts/transcripts.types'

type TranscriptListItemProps = {
  item: TranscriptsListItem
}

export function TranscriptListItem({ item }: TranscriptListItemProps): React.JSX.Element {
  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(item.text)
      toast.success(TRANSCRIPTS_COPY.actions.copied)
    } catch {
      toast.error(TRANSCRIPTS_COPY.errors.copy)
    }
  }, [item.text])

  const appLabel = resolveTranscriptAppLabel(item.targetAppName, item.targetAppIdentifier)
  const preview = formatTranscriptPreview(item.text)
  return (
    <AccordionItem
      value={`transcript-${item.transcriptId}`}
      className="border-border/70 bg-transparent not-last:border-b min-w-0 data-open:bg-muted/20"
    >
      <div className="group hover:bg-muted/45 focus-within:bg-muted/45 relative min-w-0 transition-colors">
        <AccordionTrigger className="w-full min-w-0 items-center gap-3 px-4 py-3 pr-14 hover:no-underline sm:gap-4 sm:px-5 sm:pr-14 **:data-[slot=accordion-trigger-icon]:hidden">
          <time
            dateTime={new Date(item.createdAt).toISOString()}
            className="w-14 shrink-0 text-sm font-semibold tabular-nums"
          >
            {formatTranscriptTime(item.createdAt)}
          </time>

          <span className="min-w-0 flex-1">
            <span className="text-foreground/90 block truncate text-sm font-medium">
              {preview || TRANSCRIPTS_COPY.labels.emptyTranscript}
            </span>
            <span className="text-muted-foreground mt-1 flex min-w-0 items-center gap-1.5 text-xs">
              <AppWindowIcon aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{appLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="shrink-0 tabular-nums">
                {formatTranscriptDuration(item.durationMs)}
              </span>
            </span>
          </span>

          <ChevronRightIcon
            aria-hidden="true"
            className="text-muted-foreground size-4 shrink-0 transition-transform duration-150 ease-out group-hover/accordion-trigger:translate-x-0.5 group-aria-expanded/accordion-trigger:rotate-90"
          />
        </AccordionTrigger>

        <div className="absolute top-1/2 right-2 -translate-y-1/2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => void handleCopy()}
            aria-label={TRANSCRIPTS_COPY.actions.copyTranscript}
            title={TRANSCRIPTS_COPY.actions.copyTranscript}
          >
            <CopyIcon aria-hidden="true" />
          </Button>
        </div>
      </div>

      <AccordionContent className="px-0 pb-0 sm:pl-[4.75rem] sm:pr-0">
        <p className="border-border/70 text-muted-foreground select-text border-t py-4 text-sm leading-7 whitespace-pre-wrap break-words">
          {item.text || TRANSCRIPTS_COPY.labels.emptyTranscript}
        </p>
      </AccordionContent>
    </AccordionItem>
  )
}
