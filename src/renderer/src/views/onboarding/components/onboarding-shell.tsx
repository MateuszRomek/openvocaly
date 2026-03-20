import { ONBOARDING_STEPS } from '../state-machine/steps'
import type { OnboardingStepId } from '../types/onboarding'

type OnboardingShellProps = {
  stepId: OnboardingStepId
  showHeader?: boolean
  showProgress?: boolean
  children: React.ReactNode
}

export function OnboardingShell({
  stepId,
  showHeader = true,
  showProgress = true,
  children
}: OnboardingShellProps): React.JSX.Element {
  const step = ONBOARDING_STEPS.find((candidate) => candidate.id === stepId) ?? ONBOARDING_STEPS[0]
  const hasSubtitle = step.subtitle.trim().length > 0
  const setupSteps = ONBOARDING_STEPS.filter((candidate) => candidate.id !== 'finish')
  const setupStepIndex = setupSteps.findIndex((candidate) => candidate.id === step.id)
  const setupProgressIndex = setupStepIndex >= 0 ? setupStepIndex : setupSteps.length - 1
  const setupStepNumber = setupProgressIndex + 1
  const isWelcomeStep = step.id === 'welcome'
  const chromeSpacing = showHeader
    ? 'mb-6 pb-4 pt-1 sm:mb-7 sm:pb-5'
    : 'mb-8 pb-1 pt-1 sm:mb-10 sm:pb-1'
  const chromeStack = showHeader ? 'space-y-5' : 'space-y-2'

  return (
    <section className="relative flex w-full max-w-5xl flex-col py-2 sm:py-4">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_hsl(var(--chart-2)/0.2),_transparent_55%),radial-gradient(circle_at_bottom_right,_hsl(var(--chart-1)/0.2),_transparent_55%)]" />

      <div
        className={`sticky top-0 z-20 bg-gradient-to-b from-background/90 via-background/80 to-background/0 backdrop-blur-md ${chromeSpacing}`}
      >
        <div className={chromeStack}>
          <div
            className={`transition-opacity duration-500 ease-out ${
              showProgress ? 'opacity-100' : 'opacity-0'
            } ${isWelcomeStep ? 'animate-in fade-in duration-500 delay-150' : ''}`}
          >
            <div
              className={`flex w-full flex-col gap-1.5 ${
                showHeader ? 'items-start text-left' : 'items-center text-center'
              }`}
            >
              <p className="text-muted-foreground/80 text-[0.68rem] font-medium uppercase tracking-[0.18em]">
                Step {setupStepNumber} of {setupSteps.length}
              </p>
              <div className="grid w-full max-w-[21rem] grid-cols-5 gap-1.5">
                {setupSteps.map((candidate, index) => {
                  const isComplete = step.id === 'finish' ? true : index < setupProgressIndex
                  const isCurrent = step.id === 'finish' ? false : candidate.id === step.id

                  return (
                    <span
                      key={candidate.id}
                      className={`h-1.5 rounded-full transition-colors duration-500 ease-out ${
                        isComplete
                          ? 'bg-foreground/70'
                          : isCurrent
                            ? 'bg-foreground/48'
                            : 'bg-foreground/12'
                      }`}
                    />
                  )
                })}
              </div>
            </div>
          </div>
          {showHeader ? (
            <div className="space-y-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{step.title}</h1>
              {hasSubtitle ? (
                <p className="text-muted-foreground text-base">{step.subtitle}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div>{children}</div>
    </section>
  )
}
