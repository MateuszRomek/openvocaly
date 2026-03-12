import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@renderer/ui/empty'

export function HomeMonthlyOutputEmptyState(): React.JSX.Element {
  return (
    <Empty className="border-border/60 bg-background/60 min-h-[14rem] rounded-lg border">
      <EmptyHeader>
        <EmptyTitle>No monthly output yet</EmptyTitle>
        <EmptyDescription>
          Keep dictating to build monthly output history for this chart.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
