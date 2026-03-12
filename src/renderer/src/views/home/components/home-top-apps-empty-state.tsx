import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@renderer/ui/empty'

export function HomeTopAppsEmptyState(): React.JSX.Element {
  return (
    <Empty className="border-border/60 bg-background/60 min-h-[14rem] rounded-lg border">
      <EmptyHeader>
        <EmptyTitle>No app activity yet</EmptyTitle>
        <EmptyDescription>
          Start dictating in your apps to populate this breakdown for the selected range.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
