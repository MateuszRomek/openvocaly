import { BarChart3Icon } from 'lucide-react'
import { HomeCardEmptyState } from './home-card-empty-state'

export function HomeDailyOutputEmptyState(): React.JSX.Element {
  return (
    <HomeCardEmptyState
      icon={BarChart3Icon}
      title="No daily output yet"
      description="Start dictating to populate this chart for the selected time range."
      className="min-h-[16rem]"
    />
  )
}
