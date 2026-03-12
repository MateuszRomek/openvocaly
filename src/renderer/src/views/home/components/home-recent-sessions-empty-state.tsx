import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@renderer/ui/empty'

export function HomeRecentSessionsEmptyState(): React.JSX.Element {
  return (
    <Empty className="border-border/60 bg-background/60 rounded-lg border px-3 py-4">
      <EmptyHeader>
        <EmptyTitle>No sessions yet</EmptyTitle>
        <EmptyDescription>Start a dictation to see your stats.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
