import { createFileRoute } from '@tanstack/react-router'
import { ModelsLayoutView } from '@renderer/views/models'

export const Route = createFileRoute('/models')({
  component: ModelsLayoutView
})
