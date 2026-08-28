import { useState } from 'react'
import { AlertTriangleIcon, Volume2Icon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import { Slider } from '@renderer/ui/slider'
import { useRecordingPreferences } from '@renderer/hooks/recording/use-recording-preferences'
import { SectionCard } from '@renderer/components/section-card'
import { SectionRow } from '@renderer/components/section-row'
import { SettingsRecordingAudioSkeleton } from './settings-recording-audio-skeleton'
import {
  RECORDING_SOUND_CUE_VOLUME_MAX,
  RECORDING_SOUND_CUE_VOLUME_MIN,
  RECORDING_SOUND_CUE_VOLUME_STEP
} from '../../../../../shared/recording'

type RecordingAudioControlsProps = {
  isMutating: boolean
  soundCuesEnabled: boolean
  soundCuesVolume: number
  setSoundCuesEnabled: (enabled: boolean) => void
  setSoundCuesVolume: (volume: number) => void
}

function RecordingAudioControls({
  isMutating,
  soundCuesEnabled,
  soundCuesVolume,
  setSoundCuesEnabled,
  setSoundCuesVolume
}: RecordingAudioControlsProps): React.JSX.Element {
  const [draftVolume, setDraftVolume] = useState(soundCuesVolume)

  return (
    <div className="flex w-full flex-wrap items-center gap-4 sm:w-auto sm:justify-end">
      <div className="flex min-w-56 flex-1 items-center gap-3 sm:w-60 sm:flex-none">
        <Volume2Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        <Slider
          aria-label="Recording sound volume"
          className="min-w-28 flex-1"
          disabled={!soundCuesEnabled || isMutating}
          max={RECORDING_SOUND_CUE_VOLUME_MAX}
          min={RECORDING_SOUND_CUE_VOLUME_MIN}
          step={RECORDING_SOUND_CUE_VOLUME_STEP}
          value={draftVolume}
          onValueChange={(value) => {
            setDraftVolume(value)
          }}
          onValueCommitted={(value) => {
            setSoundCuesVolume(value)
          }}
        />
        <span className="text-muted-foreground w-10 text-right text-xs font-medium tabular-nums">
          {Math.round(draftVolume * 100)}%
        </span>
      </div>
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
}

export function RecordingAudioSection(): React.JSX.Element {
  const {
    isLoading,
    isMutating,
    requestError,
    soundCuesEnabled,
    setSoundCuesEnabled,
    soundCuesVolume,
    setSoundCuesVolume
  } = useRecordingPreferences()
  if (isLoading) {
    return <SettingsRecordingAudioSkeleton />
  }

  const left = (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <h4 className="text-base font-medium">Recording sounds</h4>
        <p className="text-muted-foreground text-sm">
          Play sounds when recording starts or is canceled.
        </p>
      </div>
    </div>
  )

  const right = (
    <RecordingAudioControls
      key={`${soundCuesVolume}-${requestError ?? 'saved'}`}
      isMutating={isMutating}
      soundCuesEnabled={soundCuesEnabled}
      soundCuesVolume={soundCuesVolume}
      setSoundCuesEnabled={setSoundCuesEnabled}
      setSoundCuesVolume={setSoundCuesVolume}
    />
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
