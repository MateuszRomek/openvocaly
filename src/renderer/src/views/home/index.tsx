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
    <section className="w-full space-y-8 py-1 sm:py-2">
      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary
            onReset={reset}
            resetKeys={[selectedRange]}
            fallbackRender={({ resetErrorBoundary }) => (
              <HomeReportingFallback resetErrorBoundary={resetErrorBoundary} />
            )}
          >
            <header className="sr-only">
              <h1>Home</h1>
            </header>

            <HomePermissionsNotice />
            <section aria-labelledby="home-activity-title" className="space-y-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.16em]">
                    Activity
                  </p>
                  <h2
                    id="home-activity-title"
                    className="text-pretty text-xl font-semibold tracking-tight sm:text-2xl"
                  >
                    See Your Signal Over Time.
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    A clear view of the words, pace, and apps behind your dictation.
                  </p>
                </div>

                <HomeReportingRangeTabs value={selectedRange} onChange={handleRangeChange} />
              </div>

              <Suspense fallback={<HomeDashboardSkeleton />}>
                <HomeDashboardContent range={selectedRange} />
              </Suspense>
            </section>
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
