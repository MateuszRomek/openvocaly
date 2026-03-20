import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { DEFAULT_HOME_REPORTING_RANGE } from '@renderer/views/home/constants/reporting-range'
import { useMarkOnboardingCompletedMutation } from '../../queries/onboarding/use-mark-onboarding-completed-mutation'
import { useShortcutDisplay } from '../shared/use-shortcut-display'

export type UseFinishStepResult = {
  shortcutDisplay: string
  shortcutTokens: string[]
  hasSuccessfulTest: boolean
  isCompleting: boolean
  finishOnboarding: () => Promise<void>
}

export function useFinishStep(): UseFinishStepResult {
  const navigate = useNavigate()
  const markOnboardingCompletedMutation = useMarkOnboardingCompletedMutation()
  const shortcutDisplay = useShortcutDisplay()

  const finishOnboarding = useCallback(async (): Promise<void> => {
    await markOnboardingCompletedMutation.mutateAsync()
    await navigate({
      to: '/',
      search: {
        range: DEFAULT_HOME_REPORTING_RANGE
      }
    })
  }, [markOnboardingCompletedMutation, navigate])

  return {
    shortcutDisplay: shortcutDisplay.display,
    shortcutTokens: shortcutDisplay.tokens,
    hasSuccessfulTest: true,
    isCompleting: markOnboardingCompletedMutation.isPending,
    finishOnboarding
  }
}
