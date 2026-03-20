import { CheckCircle2Icon } from 'lucide-react'
import { Button } from '@renderer/ui/button'
import { Kbd, KbdGroup } from '@renderer/ui/kbd'
import { useFinishStep } from '../../hooks/steps/use-finish-step'

export function FinishStep(): React.JSX.Element {
  const { finishOnboarding, hasSuccessfulTest, isCompleting, shortcutTokens } = useFinishStep()

  return (
    <div className="mx-auto flex w-full max-w-[34rem] flex-col items-center space-y-5 text-center">
      <div className="w-full max-w-[22rem] space-y-3 rounded-3xl border border-border/70 bg-background/80 p-7 shadow-[0_14px_40px_hsl(var(--foreground)/0.06)]">
        <p className="text-muted-foreground/85 text-[0.68rem] font-medium uppercase tracking-[0.16em]">
          Your shortcut
        </p>
        <KbdGroup className="flex flex-wrap items-center justify-center gap-4">
          {shortcutTokens.map((token, index) => (
            <Kbd
              key={`${token}-${index}`}
              className="h-16 min-w-16 rounded-2xl border border-border/80 bg-background px-5 text-2xl font-semibold text-foreground shadow-[inset_0_-1px_0_hsl(var(--foreground)/0.1)]"
            >
              {token}
            </Kbd>
          ))}
        </KbdGroup>
        <p className="text-muted-foreground text-sm">Use anywhere</p>
      </div>

      {hasSuccessfulTest ? (
        <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300">
          <CheckCircle2Icon className="size-4 text-emerald-400" />
          Your first dictation worked perfectly.
        </p>
      ) : null}

      <Button
        size="lg"
        className="min-w-72 rounded-2xl px-10 text-base font-semibold"
        disabled={isCompleting}
        onClick={() => {
          void finishOnboarding().catch(() => undefined)
        }}
      >
        Start using OpenVocaly
      </Button>
    </div>
  )
}
