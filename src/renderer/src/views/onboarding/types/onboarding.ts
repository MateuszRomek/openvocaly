export type OnboardingStepId = 'welcome' | 'permissions' | 'engine' | 'shortcut' | 'test' | 'finish'

export type OnboardingEngineChoice = 'local' | 'cloud'

export type OnboardingStepDefinition = {
  id: OnboardingStepId
  title: string
  subtitle: string
  label: string
}
