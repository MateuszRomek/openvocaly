export const onboardingDictationKeys = {
  all: ['onboarding', 'dictation'] as const,
  runtimeState: () => [...onboardingDictationKeys.all, 'runtime-state'] as const
}
