import { createFileRoute } from '@tanstack/react-router'
import { HomeView } from '@renderer/views/home'

export const Route = createFileRoute('/')({
  component: HomeView
})
