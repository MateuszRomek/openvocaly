import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@renderer/ui/empty'

export function HomeDailyOutputEmptyState(): React.JSX.Element {
  return (
    <Empty className="border-border/60 bg-background/60 min-h-[16rem] rounded-lg border">
      <EmptyHeader>
        <EmptyTitle>No daily output yet</EmptyTitle>
        <EmptyDescription>
          Start dictating to populate this chart for the selected time range.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
