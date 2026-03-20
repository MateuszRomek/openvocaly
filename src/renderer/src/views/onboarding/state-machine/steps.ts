import type { OnboardingStepDefinition, OnboardingStepId } from '../types/onboarding'

export const ONBOARDING_STEPS: OnboardingStepDefinition[] = [
  {
    id: 'welcome',
    title: 'Welcome to OpenVocaly',
    subtitle: 'Turn your voice into text anywhere.',
    label: 'Welcome'
  },
  {
    id: 'permissions',
    title: 'Enable permissions',
    subtitle: 'OpenVocally needs permission to capture speech and insert text in apps.',
    label: 'Access'
  },
  {
    id: 'engine',
    title: 'Choose transcription mode',
    subtitle: 'Pick the setup that works best for you.',
    label: 'Engine'
  },
  {
    id: 'shortcut',
    title: 'Set your toggle command shortcut',
    subtitle: 'Click to change it, or press Continue.',
    label: 'Shortcut'
  },
  {
    id: 'test',
    title: 'Try dictation',
    subtitle: 'Do one quick dictation test to confirm everything works.',
    label: 'Test'
  },
  {
    id: 'finish',
    title: "You're ready",
    subtitle: '',
    label: 'Ready'
  }
]

export const getStepIndex = (stepId: OnboardingStepId): number =>
  ONBOARDING_STEPS.findIndex((step) => step.id === stepId)

export const getNextStepId = (stepId: OnboardingStepId): OnboardingStepId | null => {
  const index = getStepIndex(stepId)
  if (index < 0 || index >= ONBOARDING_STEPS.length - 1) {
    return null
  }

  return ONBOARDING_STEPS[index + 1].id
}

export const getPreviousStepId = (stepId: OnboardingStepId): OnboardingStepId | null => {
  const index = getStepIndex(stepId)
  if (index <= 0) {
    return null
  }

  return ONBOARDING_STEPS[index - 1].id
}
