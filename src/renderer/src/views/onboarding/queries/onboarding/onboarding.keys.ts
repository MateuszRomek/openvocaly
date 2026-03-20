export const onboardingKeys = {
  all: ['onboarding'] as const,
  state: () => [...onboardingKeys.all, 'state'] as const
}
