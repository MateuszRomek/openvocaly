import type { HomeReportingRange } from '../constants/reporting-range'
import { useHomeReportingSummaryCards } from '../hooks/use-home-reporting-summary-cards'
import { ReportingStatCard } from './reporting-stat-card'

type HomeReportingSummaryRowProps = {
  range: HomeReportingRange
}

export function HomeReportingSummaryRow({
  range
}: HomeReportingSummaryRowProps): React.JSX.Element {
  const cards = useHomeReportingSummaryCards(range)

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <ReportingStatCard
          key={card.id}
          title={card.title}
          value={card.value}
          description={card.description}
          percentage={card.percentage}
        />
      ))}
    </div>
  )
}
