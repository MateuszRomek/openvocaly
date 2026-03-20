import { AlertTriangleIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import { useRecordingPreferences } from '@renderer/hooks/recording/use-recording-preferences'
import { SectionCard } from '@renderer/components/section-card'
import { SectionRow } from '@renderer/components/section-row'
import { SettingsRecordingAudioSkeleton } from './settings-recording-audio-skeleton'

export function RecordingAudioSection(): React.JSX.Element {
  const { isLoading, isMutating, requestError, soundCuesEnabled, setSoundCuesEnabled } =
    useRecordingPreferences()

  if (isLoading) {
    return <SettingsRecordingAudioSkeleton />
  }

  const left = (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <h4 className="text-base font-medium">Recording sounds</h4>
        <p className="text-muted-foreground text-sm">
          Play a sound when recording starts or is canceled for instant feedback.
        </p>
      </div>
    </div>
  )

  const right = (
    <div className="flex w-full justify-start sm:w-auto sm:justify-end">
      <button
        type="button"
        role="switch"
        aria-checked={soundCuesEnabled}
        aria-label="Enable recording sounds"
        onClick={() => {
          setSoundCuesEnabled(!soundCuesEnabled)
        }}
        disabled={isMutating}
        className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-colors ${
          soundCuesEnabled ? 'bg-primary/90 border-primary/70' : 'bg-muted/40 border-border/65'
        } ${isMutating ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <span
          className={`bg-background block size-5 rounded-full shadow-sm transition-transform ${
            soundCuesEnabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">Sound feedback</h3>

      {requestError && (
        <Alert variant="destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <AlertTitle>Could not save sound settings</AlertTitle>
          <AlertDescription>{requestError}</AlertDescription>
        </Alert>
      )}

      <SectionCard>
        <SectionRow isLast left={left} right={right} minHeightClass="min-h-[7rem]" stackOnMobile />
      </SectionCard>
    </section>
  )
}
