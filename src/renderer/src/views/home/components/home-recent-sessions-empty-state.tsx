import { Clock3Icon } from 'lucide-react'
import { HomeCardEmptyState } from './home-card-empty-state'

export function HomeRecentSessionsEmptyState(): React.JSX.Element {
  return (
    <HomeCardEmptyState
      icon={Clock3Icon}
      title="No sessions yet"
      description="Start a dictation to see your stats."
    />
  )
}
