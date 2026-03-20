import { useOnboarding } from '../context/onboarding-context'
import { EngineStep } from './steps/engine-step'
import { FinishStep } from './steps/finish-step'
import { PermissionsStep } from './steps/permissions-step'
import { ShortcutStep } from './steps/shortcut-step'
import { TestStep } from './steps/test-step'
import { WelcomeStep } from './steps/welcome-step'

export function OnboardingStepRenderer(): React.JSX.Element | null {
  const { currentStep } = useOnboarding()

  if (currentStep === 'welcome') {
    return <WelcomeStep />
  }

  if (currentStep === 'permissions') {
    return <PermissionsStep />
  }

  if (currentStep === 'engine') {
    return <EngineStep />
  }

  if (currentStep === 'shortcut') {
    return <ShortcutStep />
  }

  if (currentStep === 'test') {
    return <TestStep />
  }

  if (currentStep === 'finish') {
    return <FinishStep />
  }

  return null
}
