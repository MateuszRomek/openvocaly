import { Button } from '@renderer/ui/button'
import { CardAction } from '@renderer/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@renderer/ui/sheet'
import type { HomeTopAppDetailRow } from '../hooks/use-home-top-apps'

type HomeTopAppsSheetProps = {
  appDetails: HomeTopAppDetailRow[]
}

const wordsFormatter = new Intl.NumberFormat('en-US')
const wpmFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2
})

export function HomeTopAppsSheet({ appDetails }: HomeTopAppsSheetProps): React.JSX.Element {
  return (
    <Sheet>
      <CardAction>
        <SheetTrigger render={<Button variant="outline" size="sm" />}>All apps</SheetTrigger>
      </CardAction>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>All Apps</SheetTitle>
          <SheetDescription>Full breakdown for the selected time range.</SheetDescription>
        </SheetHeader>

        <div className="app-scroll-area flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-2">
            {appDetails.map((row) => (
              <div
                key={row.appKey}
                className="border-border/60 bg-background/60 rounded-lg border px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{row.appLabel}</p>
                    <p className="text-muted-foreground text-xs">
                      {row.interactions} dictation {row.interactions === 1 ? 'session' : 'sessions'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{wordsFormatter.format(row.words)}</p>
                    <p className="text-muted-foreground text-xs">
                      {row.sharePct.toFixed(1)}% share
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Avg WPM in this app:{' '}
                  {row.averageWpm === null ? '—' : wpmFormatter.format(row.averageWpm)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
