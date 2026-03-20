import { OnboardingNavigation } from './components/onboarding-navigation'
import { OnboardingShell } from './components/onboarding-shell'
import { OnboardingStepRenderer } from './components/onboarding-step-renderer'
import { OnboardingProvider, useOnboarding } from './context/onboarding-context'

function OnboardingContent(): React.JSX.Element {
  const { currentStep, navigation, canGoBack, canGoNext, goBack, goNext } = useOnboarding()

  const showDefaultNavigation = currentStep !== 'finish' && currentStep !== 'welcome'

  return (
    <OnboardingShell stepId={currentStep} showHeader={currentStep !== 'welcome'} showProgress>
      <div className="space-y-8">
        <OnboardingStepRenderer />

        {showDefaultNavigation ? (
          <OnboardingNavigation
            canGoBack={canGoBack}
            canGoNext={canGoNext}
            isBusy={Boolean(navigation.isBusy)}
            continueDisabledHint={navigation.continueDisabledHint}
            onBack={goBack}
            onNext={goNext}
          />
        ) : null}
      </div>
    </OnboardingShell>
  )
}

export function OnboardingView(): React.JSX.Element {
  return (
    <OnboardingProvider>
      <OnboardingContent />
    </OnboardingProvider>
  )
}
