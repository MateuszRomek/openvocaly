import { createFileRoute } from '@tanstack/react-router'
import { SettingsView } from '@renderer/views/settings'

export const Route = createFileRoute('/settings')({
  component: SettingsView
})
