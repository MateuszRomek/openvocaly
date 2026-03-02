import { createFileRoute } from '@tanstack/react-router'
import { LocalModelsView } from '@renderer/views/models/local'

export const Route = createFileRoute('/models/local')({
  component: LocalModelsView
})
