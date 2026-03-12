import { GaugeIcon } from 'lucide-react'
import { HomeCardEmptyState } from './home-card-empty-state'

export function HomeWpmTrendEmptyState(): React.JSX.Element {
  return (
    <HomeCardEmptyState
      icon={GaugeIcon}
      title="No WPM data yet"
      description="Complete a few dictation sessions to see your speed trend in this time range."
    />
  )
}
