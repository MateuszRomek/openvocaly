import { CalendarDaysIcon } from 'lucide-react'
import { HomeCardEmptyState } from './home-card-empty-state'

export function HomeMonthlyOutputEmptyState(): React.JSX.Element {
  return (
    <HomeCardEmptyState
      icon={CalendarDaysIcon}
      title="No monthly output yet"
      description="Keep dictating to build monthly output history for this chart."
    />
  )
}
