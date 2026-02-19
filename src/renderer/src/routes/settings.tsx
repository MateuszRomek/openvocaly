import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings')({
  component: Settings
})

function Settings(): React.JSX.Element {
  return (
    <section className="settings">
      <h2 className="settings__title">Settings</h2>
      <p className="settings__description">Settings live here.</p>
    </section>
  )
}
