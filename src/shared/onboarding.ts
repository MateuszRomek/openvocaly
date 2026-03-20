export type OnboardingState = {
  version: 1
  completed: boolean
  completedAt: number | null
}

export type OnboardingStateResponse = {
  state: OnboardingState
}

export type OnboardingMarkCompletedResponse = {
  ok: boolean
  state: OnboardingState
}
