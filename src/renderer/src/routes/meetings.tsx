import { createFileRoute } from '@tanstack/react-router'
import { MeetingsView } from '@renderer/views/meetings'

export const Route = createFileRoute('/meetings')({
  component: MeetingsView
})
