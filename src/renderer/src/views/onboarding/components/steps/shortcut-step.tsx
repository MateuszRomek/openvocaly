import { useEffect, useMemo, useRef } from 'react'
import { AlertCircleIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import { Kbd, KbdGroup } from '@renderer/ui/kbd'
import { useOnboardingStepNavigation } from '../../hooks/use-onboarding-step-navigation'
import { useShortcutStep } from '../../hooks/steps/use-shortcut-step'

export function ShortcutStep(): React.JSX.Element {
  const {
    display,
    error,
    idleHint,
    isCapturing,
    onShortcutCaptureKeyDown,
    recordingHint,
    startShortcutCapture,
    stopShortcutCapture
  } = useShortcutStep()
  const captureSurfaceRef = useRef<HTMLButtonElement>(null)

  const navigationState = useMemo(
    () => ({
      canContinue: true,
      isBusy: false
    }),
    []
  )

  useOnboardingStepNavigation(navigationState)

  const displayTokens = useMemo(() => {
    return display
      .split(/\s*\+\s*/g)
      .map((token) => token.trim())
      .filter(Boolean)
  }, [display])

  useEffect(() => {
    if (!isCapturing) {
      return
    }

    captureSurfaceRef.current?.focus()
  }, [isCapturing])

  useEffect(() => {
    if (!isCapturing) {
      return
    }

    const onWindowKeyDown = (event: KeyboardEvent): void => {
      onShortcutCaptureKeyDown(event)
    }

    window.addEventListener('keydown', onWindowKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onWindowKeyDown, true)
    }
  }, [isCapturing, onShortcutCaptureKeyDown])

  const handleSurfaceClick = (): void => {
    if (isCapturing) {
      stopShortcutCapture()
      return
    }

    startShortcutCapture()
  }

  return (
    <div className="space-y-4">
      <button
        ref={captureSurfaceRef}
        type="button"
        onClick={handleSurfaceClick}
        aria-pressed={isCapturing}
        className={`group w-full space-y-3 rounded-2xl border bg-background/70 p-6 text-left transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 ${
          isCapturing
            ? 'cursor-pointer border-primary/75 bg-background/90 shadow-[0_0_0_1px_hsl(var(--primary)/0.34),0_0_34px_hsl(var(--primary)/0.2)]'
            : 'cursor-pointer border-border/70 hover:border-foreground/35 hover:bg-background/88 hover:shadow-[0_0_0_1px_hsl(var(--foreground)/0.08)]'
        }`}
      >
        <div className="space-y-2.5">
          <p className="text-sm">Shortcut</p>

          {isCapturing ? (
            <div className="min-h-12 space-y-1">
              <p className="text-xl font-semibold tracking-tight">Press new shortcut…</p>
              <p className="text-muted-foreground text-sm">{recordingHint}</p>
            </div>
          ) : (
            <div className="flex min-h-12 flex-wrap items-center gap-2.5">
              <KbdGroup className="flex flex-wrap gap-2.5">
                {displayTokens.map((token, index) => (
                  <Kbd
                    key={`${token}-${index}`}
                    className="h-12 min-w-12 rounded-lg border border-border/75 bg-background/90 px-3.5 text-[1rem] font-semibold text-foreground shadow-[inset_0_-1px_0_hsl(var(--foreground)/0.08)] transition-colors duration-300 ease-out group-hover:border-foreground/35"
                  >
                    {token}
                  </Kbd>
                ))}
              </KbdGroup>
            </div>
          )}

          {!isCapturing ? <p className="text-muted-foreground text-sm">{idleHint}</p> : null}
        </div>
      </button>

      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon className="size-4" />
          <AlertTitle>Shortcut update failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
