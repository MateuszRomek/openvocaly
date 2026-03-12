import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/ui/card'
import type { HomeReportingRange } from '../constants/reporting-range'
import { useHomeRecentSessions } from '../hooks/use-home-recent-sessions'
import { HomeRecentSessionsEmptyState } from './home-recent-sessions-empty-state'

type HomeRecentSessionsCardProps = {
  range: HomeReportingRange
}

const wordsFormatter = new Intl.NumberFormat('en-US')

export function HomeRecentSessionsCard({ range }: HomeRecentSessionsCardProps): React.JSX.Element {
  const { sessions, hasSessions } = useHomeRecentSessions(range)

  return (
    <Card className="bg-card/95 ring-foreground/8">
      <CardHeader className="border-border/50 border-b">
        <CardTitle>Recent sessions</CardTitle>
        <CardDescription>Latest dictations in the selected time range.</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="border-border/60 bg-background/60 grid grid-cols-[1.45fr_0.8fr_0.6fr_0.9fr_0.9fr] items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-medium tracking-wide uppercase">
          <span className="text-muted-foreground">Time</span>
          <span className="text-muted-foreground text-right">Words</span>
          <span className="text-muted-foreground text-right">WPM</span>
          <span className="text-muted-foreground text-right">Duration</span>
          <span className="text-muted-foreground text-right">App</span>
        </div>

        <div className="mt-2 space-y-2">
          {hasSessions ? (
            sessions.map((session) => (
              <div
                key={session.sessionId}
                className="border-border/60 bg-background/60 grid grid-cols-[1.45fr_0.8fr_0.6fr_0.9fr_0.9fr] items-center gap-2 rounded-lg border px-3 py-2"
              >
                <span className="text-sm font-medium">{session.at}</span>
                <span className="text-right font-mono text-sm tabular-nums">
                  {wordsFormatter.format(session.words)}
                </span>
                <span className="text-right font-mono text-sm tabular-nums">
                  {session.wpmDisplay}
                </span>
                <span className="text-muted-foreground text-right font-mono text-xs tabular-nums">
                  {session.duration}
                </span>
                <span className="text-muted-foreground text-right text-xs">{session.app}</span>
              </div>
            ))
          ) : (
            <HomeRecentSessionsEmptyState />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
