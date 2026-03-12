import { BarChart3Icon, Clock3Icon, MicIcon, SparklesIcon } from 'lucide-react'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@renderer/ui/empty'

export function HomeFirstRunEmptyState(): React.JSX.Element {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 p-6 sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--chart-3)/0.22),_transparent_54%),radial-gradient(circle_at_bottom,_hsl(var(--chart-1)/0.2),_transparent_50%)]" />

      <Empty className="relative z-10 min-h-[25rem] rounded-[1.5rem] border border-border/70 bg-background/60">
        <EmptyHeader className="max-w-xl gap-3">
          <EmptyMedia
            variant="icon"
            className="size-14 rounded-full border border-border/80 bg-card/90 text-primary [&_svg:not([class*=size-])]:size-6"
          >
            <SparklesIcon className="size-6" />
          </EmptyMedia>
          <EmptyTitle className="text-xl sm:text-2xl">Your dashboard is ready</EmptyTitle>
          <EmptyDescription className="max-w-lg text-sm sm:text-base">
            Start your first dictation and Home will automatically fill with trends, app activity,
            and recent sessions.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent className="max-w-xl">
          <div className="grid w-full gap-2 sm:grid-cols-3">
            <div className="border-border/70 bg-background/70 flex h-10 items-center justify-center gap-2 rounded-lg border px-3">
              <MicIcon className="text-muted-foreground size-4 shrink-0" />
              <span className="text-sm font-medium">Start dictating</span>
            </div>
            <div className="border-border/70 bg-background/70 flex h-10 items-center justify-center gap-2 rounded-lg border px-3">
              <BarChart3Icon className="text-muted-foreground size-4 shrink-0" />
              <span className="text-sm font-medium">Track performance</span>
            </div>
            <div className="border-border/70 bg-background/70 flex h-10 items-center justify-center gap-2 rounded-lg border px-3">
              <Clock3Icon className="text-muted-foreground size-4 shrink-0" />
              <span className="text-sm font-medium">Review sessions</span>
            </div>
          </div>
        </EmptyContent>
      </Empty>
    </section>
  )
}
