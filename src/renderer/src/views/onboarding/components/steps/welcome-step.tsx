import OpenVocalyLogo from '@renderer/components/openvocaly-logo'
import { Button } from '@renderer/ui/button'
import { useOnboarding } from '../../context/onboarding-context'

export function WelcomeStep(): React.JSX.Element {
  const { goToStep } = useOnboarding()

  return (
    <div className="animate-in fade-in-0 relative mx-auto flex min-h-[24rem] w-full max-w-[32rem] flex-col items-center justify-center gap-3 text-center duration-300 ease-out">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-52 -translate-y-1/2 bg-[radial-gradient(circle,_hsl(var(--foreground)/0.14)_0%,_transparent_72%)] blur-3xl" />

      <OpenVocalyLogo size={154} className="text-foreground" animate={false} />

      <div className="mx-auto max-w-[30rem] space-y-3">
        <div className="space-y-2.5">
          <p className="text-foreground/78 text-[0.7rem] font-medium uppercase tracking-[0.14em]">
            Welcome to OpenVocally
          </p>
          <h2 className="mx-auto max-w-[25rem] text-[1.95rem] font-semibold leading-[1.16] tracking-tight sm:text-[2.3rem]">
            Turn your voice into text in any app
          </h2>
        </div>

        <Button
          size="lg"
          className="min-w-56 rounded-2xl mt-6 px-10 text-[1.02rem] font-semibold shadow-[0_10px_28px_hsl(var(--foreground)/0.16)] transition-transform duration-500 ease-out hover:scale-[1.015]"
          onClick={() => goToStep('permissions')}
        >
          Start Setup
        </Button>
      </div>
    </div>
  )
}
