import { LayoutGridIcon } from 'lucide-react'
import { HomeCardEmptyState } from './home-card-empty-state'

export function HomeTopAppsEmptyState(): React.JSX.Element {
  return (
    <HomeCardEmptyState
      icon={LayoutGridIcon}
      title="No app activity yet"
      description="Start dictating in your apps to populate this breakdown for the selected time range."
    />
  )
}
