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

type HomeReportingFallbackProps = {
  resetErrorBoundary: () => void
}

export function HomeReportingFallback({
  resetErrorBoundary
}: HomeReportingFallbackProps): React.JSX.Element {
  return (
    <section className="w-full py-2">
      <Empty className="border-border/70 min-h-[22rem] rounded-2xl border bg-card/70">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertTriangleIcon className="size-4" />
          </EmptyMedia>
          <EmptyTitle>Could not load reporting</EmptyTitle>
          <EmptyDescription>
            Something went wrong while fetching your home metrics.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <Button type="button" onClick={resetErrorBoundary}>
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    </section>
  )
}
