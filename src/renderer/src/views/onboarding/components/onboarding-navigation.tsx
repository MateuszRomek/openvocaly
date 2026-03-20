import { Button } from '@renderer/ui/button'

type OnboardingNavigationProps = {
  canGoBack: boolean
  canGoNext: boolean
  isBusy: boolean
  continueDisabledHint?: string
  onBack: () => void
  onNext: () => void
}

export function OnboardingNavigation({
  canGoBack,
  canGoNext,
  isBusy,
  continueDisabledHint,
  onBack,
  onNext
}: OnboardingNavigationProps): React.JSX.Element {
  const isContinueDisabled = !canGoNext || isBusy

  return (
    <div className="flex items-center justify-between">
      <Button variant="outline" className="px-4" onClick={onBack} disabled={!canGoBack}>
        Back
      </Button>
      <Button
        onClick={onNext}
        disabled={isContinueDisabled}
        title={isContinueDisabled ? continueDisabledHint : undefined}
      >
        Continue
      </Button>
    </div>
  )
}
