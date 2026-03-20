/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { getNextStepId, getPreviousStepId } from '../state-machine/steps'
import type { OnboardingStepId } from '../types/onboarding'

export type OnboardingStepNavigationState = {
  canContinue: boolean
  isBusy?: boolean
  continueDisabledHint?: string
}

type OnboardingContextValue = {
  currentStep: OnboardingStepId
  navigation: OnboardingStepNavigationState
  canGoBack: boolean
  canGoNext: boolean
  goNext: () => void
  goBack: () => void
  goToStep: (stepId: OnboardingStepId) => void
  setStepNavigationState: (state: OnboardingStepNavigationState) => void
  resetStepNavigationState: () => void
}

const DEFAULT_NAVIGATION_STATE: OnboardingStepNavigationState = {
  canContinue: false,
  isBusy: false,
  continueDisabledHint: undefined
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

type OnboardingProviderProps = {
  children: React.ReactNode
}

export function OnboardingProvider({ children }: OnboardingProviderProps): React.JSX.Element {
  const [currentStep, setCurrentStep] = useState<OnboardingStepId>('welcome')
  const [navigation, setNavigation] =
    useState<OnboardingStepNavigationState>(DEFAULT_NAVIGATION_STATE)

  const resetStepNavigationState = useCallback((): void => {
    setNavigation(DEFAULT_NAVIGATION_STATE)
  }, [])

  const goToStep = useCallback((stepId: OnboardingStepId): void => {
    setCurrentStep(stepId)
    setNavigation(DEFAULT_NAVIGATION_STATE)
  }, [])

  const goBack = useCallback((): void => {
    const previous = getPreviousStepId(currentStep)
    if (!previous) {
      return
    }

    setCurrentStep(previous)
    setNavigation(DEFAULT_NAVIGATION_STATE)
  }, [currentStep])

  const canGoBack = useMemo(() => getPreviousStepId(currentStep) !== null, [currentStep])

  const canGoNext = useMemo(() => {
    const hasNextStep = getNextStepId(currentStep) !== null
    return hasNextStep && navigation.canContinue && !navigation.isBusy
  }, [currentStep, navigation.canContinue, navigation.isBusy])

  const goNext = useCallback((): void => {
    if (!canGoNext) {
      return
    }

    const next = getNextStepId(currentStep)
    if (!next) {
      return
    }

    setCurrentStep(next)
    setNavigation(DEFAULT_NAVIGATION_STATE)
  }, [canGoNext, currentStep])

  const value = useMemo<OnboardingContextValue>(
    () => ({
      currentStep,
      navigation,
      canGoBack,
      canGoNext,
      goNext,
      goBack,
      goToStep,
      setStepNavigationState: setNavigation,
      resetStepNavigationState
    }),
    [
      canGoBack,
      canGoNext,
      currentStep,
      goBack,
      goNext,
      goToStep,
      navigation,
      resetStepNavigationState
    ]
  )

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext)

  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider.')
  }

  return context
}
