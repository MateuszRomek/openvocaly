import type { JSX } from 'react'

export function CloudModelsView(): JSX.Element {
  return (
    <section className="border-border/70 bg-card/90 w-full rounded-2xl border p-6 shadow-sm backdrop-blur-sm">
      <header className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight sm:text-lg">Cloud Models</h3>
        <p className="text-muted-foreground text-sm">
          Cloud provider configuration will be added in the next implementation phase.
        </p>
      </header>
    </section>
  )
}
