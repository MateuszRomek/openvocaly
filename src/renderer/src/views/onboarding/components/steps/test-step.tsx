import { useMemo } from 'react'
import { Button } from '@renderer/ui/button'
import { Kbd, KbdGroup } from '@renderer/ui/kbd'
import { Spinner } from '@renderer/ui/spinner'
import { useOnboardingStepNavigation } from '../../hooks/use-onboarding-step-navigation'
import { useTestStep } from '../../hooks/steps/use-test-step'

export function TestStep(): React.JSX.Element {
  const {
    canClear,
    insertedText,
    isIdle,
    isListening,
    isProcessing,
    isReady,
    isSuccessful,
    resetDictationTest,
    shortcutTokens
  } = useTestStep()

  const navigationState = useMemo(
    () => ({
      canContinue: isReady,
      isBusy: false
    }),
    [isReady]
  )

  useOnboardingStepNavigation(navigationState)

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <p className="text-sm leading-relaxed">
          Press
          <KbdGroup className="mx-1 inline-flex align-middle">
            {shortcutTokens.map((token, index) => (
              <Kbd
                key={`${token}-${index}`}
                className="h-6 min-w-6 rounded-md border border-border/70 bg-background/80 px-2 text-sm font-semibold text-foreground"
              >
                {token}
              </Kbd>
            ))}
          </KbdGroup>
          and start speaking.
        </p>
        <p className="text-muted-foreground text-sm">Press again to stop.</p>
      </div>

      <div
        className={`rounded-2xl border bg-background/70 p-5 transition-all duration-300 ease-out ${
          isListening
            ? 'border-primary/70 shadow-[0_0_0_1px_hsl(var(--primary)/0.24),0_0_28px_hsl(var(--primary)/0.16)]'
            : 'border-border/70'
        }`}
      >
        <div className="min-h-28">
          {isListening ? (
            <div className="text-muted-foreground flex min-h-28 items-center gap-2 text-base">
              <span className="inline-flex size-2.5 animate-pulse rounded-full bg-primary/90" />
              <span>Listening…</span>
            </div>
          ) : null}

          {isProcessing ? (
            <div className="text-muted-foreground flex min-h-28 items-center gap-2 text-base">
              <Spinner className="size-4" />
              <span>Transcribing…</span>
            </div>
          ) : null}

          {isSuccessful ? (
            <p className="animate-in fade-in zoom-in-95 min-h-28 whitespace-pre-wrap text-base leading-relaxed duration-200">
              {insertedText}
            </p>
          ) : null}

          {isIdle ? (
            <p className="text-muted-foreground min-h-28 text-base leading-relaxed">
              Your text will appear here…
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="text-muted-foreground text-sm">
          Try: &ldquo;This is a test of OpenVocaly&rdquo;
        </p>
        {canClear ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-1 text-muted-foreground hover:text-foreground"
            onClick={resetDictationTest}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  )
}
