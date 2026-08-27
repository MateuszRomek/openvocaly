import type { JSX } from 'react'
import { Outlet } from '@tanstack/react-router'

export function ModelsLayoutView(): JSX.Element {
  return (
    <section className="w-full max-w-4xl space-y-5 py-1 sm:py-2">
      <header className="space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Models</h2>
        <p className="text-muted-foreground text-sm">
          Download and choose your local transcription model.
        </p>
      </header>

      <Outlet />
    </section>
  )
}
