import { AlertTriangleIcon } from 'lucide-react'
import { Button } from '@renderer/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@renderer/ui/empty'
import { TRANSCRIPTS_COPY } from '../constants/copy'

type TranscriptsErrorStateProps = {
  onRetry: () => void
}

export function TranscriptsErrorState({ onRetry }: TranscriptsErrorStateProps): React.JSX.Element {
  return (
    <Empty className="border-border/70 min-h-[16rem] rounded-2xl border bg-card/70">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertTriangleIcon className="size-4" />
        </EmptyMedia>
        <EmptyTitle>{TRANSCRIPTS_COPY.errors.load}</EmptyTitle>
        <EmptyDescription>
          We could not load transcript history. Check again in a moment.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Button type="button" onClick={onRetry}>
          {TRANSCRIPTS_COPY.actions.retry}
        </Button>
      </EmptyContent>
    </Empty>
  )
}
