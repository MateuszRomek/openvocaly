import type { JSX } from 'react'
import { CpuIcon } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@renderer/ui/empty'

export function LocalModelsView(): JSX.Element {
  return (
    <section className="border-border/70 bg-card/90 w-full rounded-2xl border p-6 shadow-sm backdrop-blur-sm">
      <Empty className="bg-muted/30 border-border/70 py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CpuIcon />
          </EmptyMedia>
          <EmptyTitle>Local Models Coming Soon</EmptyTitle>
          <EmptyDescription>
            This tab will include local runtime setup, model downloads, and hardware compatibility
            controls. Cloud models are currently prioritized.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  )
}
