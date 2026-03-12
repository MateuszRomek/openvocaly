import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@renderer/ui/empty'

export function HomeWpmTrendEmptyState(): React.JSX.Element {
  return (
    <Empty className="border-border/60 bg-background/60 min-h-[14rem] rounded-lg border">
      <EmptyHeader>
        <EmptyTitle>No WPM data yet</EmptyTitle>
        <EmptyDescription>
          Complete a few dictation sessions to see your speed trend in this time range.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
