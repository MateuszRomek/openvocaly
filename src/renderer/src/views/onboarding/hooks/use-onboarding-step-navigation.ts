import { useEffect } from 'react'
import type { OnboardingStepNavigationState } from '../context/onboarding-context'
import { useOnboarding } from '../context/onboarding-context'

export function useOnboardingStepNavigation(state: OnboardingStepNavigationState): void {
  const { setStepNavigationState, resetStepNavigationState } = useOnboarding()

  useEffect(() => {
    setStepNavigationState(state)

    return () => {
      resetStepNavigationState()
    }
  }, [resetStepNavigationState, setStepNavigationState, state])
}
