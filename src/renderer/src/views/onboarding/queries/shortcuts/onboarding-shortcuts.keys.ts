export const onboardingShortcutsKeys = {
  all: ['onboarding', 'shortcuts'] as const,
  config: () => [...onboardingShortcutsKeys.all, 'config'] as const
}
