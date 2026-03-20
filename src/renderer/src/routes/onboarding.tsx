import { createFileRoute } from '@tanstack/react-router'
import { OnboardingView } from '@renderer/views/onboarding'

export const Route = createFileRoute('/onboarding')({
  component: OnboardingView
})
