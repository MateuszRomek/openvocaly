import { Suspense, useTransition } from 'react'
import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ErrorBoundary } from 'react-error-boundary'
import { HomeReportingFallback } from './components/home-reporting-fallback'
import { HomeDailyOutputCard } from './components/home-daily-output-card'
import { HomeDailyOutputCardSkeleton } from './components/home-daily-output-card-skeleton'
import { HomeMonthlyOutputCard } from './components/home-monthly-output-card'
import { HomeMonthlyOutputCardSkeleton } from './components/home-monthly-output-card-skeleton'
import { HomePermissionsNotice } from './components/home-permissions-notice'
import { HomeReportingRangeTabs } from './components/home-reporting-range-tabs'
import { HomeReportingSummaryRow } from './components/home-reporting-summary-row'
import { HomeReportingSummaryRowSkeleton } from './components/home-reporting-summary-row-skeleton'
import { HomeTopAppsCard } from './components/home-top-apps-card'
import { HomeTopAppsCardSkeleton } from './components/home-top-apps-card-skeleton'
import { type HomeReportingRange } from './constants/reporting-range'

export function HomeView(): React.JSX.Element {
  const search = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  const [, startTransition] = useTransition()
  const selectedRange = search.range

  const handleRangeChange = (nextRange: HomeReportingRange): void => {
    if (nextRange === selectedRange) {
      return
    }

    startTransition(() => {
      void navigate({
        search: (previous) => ({
          ...previous,
          range: nextRange
        })
      })
    })
  }

  return (
    <section className="relative w-full space-y-5 py-1 sm:space-y-6 sm:py-2">
      <div className="pointer-events-none absolute inset-x-8 top-2 -z-10 h-52 rounded-[2rem] bg-gradient-to-r from-chart-3/10 via-chart-2/10 to-chart-1/10 blur-3xl" />

      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary
            onReset={reset}
            resetKeys={[selectedRange]}
            fallbackRender={({ resetErrorBoundary }) => (
              <HomeReportingFallback resetErrorBoundary={resetErrorBoundary} />
            )}
          >
            <header className="space-y-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="space-y-1.5">
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Home</h2>
                  <p className="text-muted-foreground text-sm">
                    Track words dictated, speed, and app usage.
                  </p>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <HomeReportingRangeTabs value={selectedRange} onChange={handleRangeChange} />
                </div>
              </div>
            </header>

            <HomePermissionsNotice />

            <Suspense fallback={<HomeDashboardSkeleton />}>
              <HomeDashboardContent range={selectedRange} />
            </Suspense>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    </section>
  )
}

type HomeDashboardContentProps = {
  range: HomeReportingRange
}

function HomeDashboardContent({ range }: HomeDashboardContentProps): React.JSX.Element {
  return (
    <>
      <HomeReportingSummaryRow range={range} />

      <Suspense fallback={<HomeDailyOutputCardSkeleton />}>
        <HomeDailyOutputCard range={range} />
      </Suspense>

      <div className="grid gap-4 xl:grid-cols-2">
        <Suspense fallback={<HomeTopAppsCardSkeleton />}>
          <HomeTopAppsCard range={range} />
        </Suspense>

        <Suspense fallback={<HomeMonthlyOutputCardSkeleton />}>
          <HomeMonthlyOutputCard />
        </Suspense>
      </div>
    </>
  )
}

function HomeDashboardSkeleton(): React.JSX.Element {
  return (
    <>
      <HomeReportingSummaryRowSkeleton />
      <HomeDailyOutputCardSkeleton />

      <div className="grid gap-4 xl:grid-cols-2">
        <HomeTopAppsCardSkeleton />
        <HomeMonthlyOutputCardSkeleton />
      </div>
    </>
  )
}
