import { InboxIcon } from 'lucide-react'
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

type TranscriptsEmptyStateProps = {
  isOutOfRange: boolean
  onGoToLastPage?: () => void
}

export function TranscriptsEmptyState({
  isOutOfRange,
  onGoToLastPage
}: TranscriptsEmptyStateProps): React.JSX.Element {
  const title = isOutOfRange ? TRANSCRIPTS_COPY.emptyPage.title : TRANSCRIPTS_COPY.empty.title
  const description = isOutOfRange
    ? TRANSCRIPTS_COPY.emptyPage.description
    : TRANSCRIPTS_COPY.empty.description

  return (
    <Empty className="border-border/70 min-h-[16rem] rounded-2xl border bg-card/70">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon className="size-4" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>

      {isOutOfRange && onGoToLastPage ? (
        <EmptyContent>
          <Button type="button" variant="outline" onClick={onGoToLastPage}>
            {TRANSCRIPTS_COPY.actions.goToLastPage}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}
