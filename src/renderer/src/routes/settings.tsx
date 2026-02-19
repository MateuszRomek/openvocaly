import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings')({
  component: Settings
})

function Settings(): React.JSX.Element {
  return (
    <section className="border-border/70 bg-card/90 w-full max-w-3xl rounded-3xl border p-8 shadow-sm backdrop-blur-sm">
      <p className="text-muted-foreground text-sm">Settings page content.</p>
    </section>
  )
}
