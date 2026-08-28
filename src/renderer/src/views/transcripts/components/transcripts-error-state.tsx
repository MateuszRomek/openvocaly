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
    <Empty role="alert" className="border-border/70 min-h-[18rem] rounded-2xl border bg-card/70">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertTriangleIcon className="size-4" />
        </EmptyMedia>
        <EmptyTitle>{TRANSCRIPTS_COPY.errors.load}</EmptyTitle>
        <EmptyDescription>{TRANSCRIPTS_COPY.errors.description}</EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Button type="button" onClick={onRetry}>
          {TRANSCRIPTS_COPY.actions.retry}
        </Button>
      </EmptyContent>
    </Empty>
  )
}
