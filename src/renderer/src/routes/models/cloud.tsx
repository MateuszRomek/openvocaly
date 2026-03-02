import { createFileRoute } from '@tanstack/react-router'
import { CloudModelsView } from '@renderer/views/models/cloud'

export const Route = createFileRoute('/models/cloud')({
  component: CloudModelsView
})
