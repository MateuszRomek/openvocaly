import { AlertTriangleIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from '@renderer/ui/select'
import { SectionCard } from '@renderer/components/section-card'
import { SectionRow } from '@renderer/components/section-row'
import { useRecordingMicrophoneSelection } from '../hooks/use-recording-microphone-selection'
import { SettingsRecordingMicrophoneSkeleton } from './settings-recording-microphone-skeleton'

export function RecordingMicrophoneSection(): React.JSX.Element {
  const {
    isLoading,
    requestError,
    devicesError,
    isDeviceEnumerationAvailable,
    isPermissionBlocked,
    permissionMessage,
    hasNoDevices,
    deviceOptions,
    selectedOptionId,
    selectedLabel,
    selectDisabled,
    handleValueChange
  } = useRecordingMicrophoneSelection()

  if (isLoading) {
    return <SettingsRecordingMicrophoneSkeleton />
  }

  const prioritizedError = requestError ?? devicesError
  const prioritizedErrorTitle = requestError
    ? 'Could not save recording settings'
    : 'Could not load microphones'

  const left = (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <h4 className="text-base font-medium">Input device</h4>
        <p className="text-muted-foreground text-sm">
          Choose the microphone used for recording.
        </p>
      </div>
      {isPermissionBlocked ? (
        <p className="text-muted-foreground text-xs">
          {permissionMessage ?? 'Allow microphone access to choose an input device.'}
        </p>
      ) : null}
      {!isDeviceEnumerationAvailable ? (
        <p className="text-muted-foreground text-xs">
          Microphone list is not available in this environment.
        </p>
      ) : null}
      {!isPermissionBlocked && hasNoDevices ? (
        <p className="text-muted-foreground text-xs">No input devices available.</p>
      ) : null}
    </div>
  )

  const right = (
    <div className="flex w-full justify-start sm:w-auto sm:justify-end">
      <Select value={selectedOptionId} onValueChange={handleValueChange} disabled={selectDisabled}>
        <SelectTrigger className="w-full sm:w-56" aria-label="Microphone device">
          <span className={`block truncate ${selectedLabel ? '' : 'text-muted-foreground'}`}>
            {selectedLabel ?? 'Choose microphone'}
          </span>
        </SelectTrigger>
        <SelectContent
          side="bottom"
          align="start"
          sideOffset={8}
          className="min-w-[14rem] max-w-[18rem]"
        >
          <SelectGroup>
            {deviceOptions.map((device) => (
              <SelectItem key={device.optionId} value={device.optionId}>
                <span className="block max-w-[12.5rem] truncate">{device.label}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">Microphone</h3>

      {prioritizedError && (
        <Alert variant="destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <AlertTitle>{prioritizedErrorTitle}</AlertTitle>
          <AlertDescription>{prioritizedError}</AlertDescription>
        </Alert>
      )}

      <SectionCard>
        <SectionRow isLast left={left} right={right} minHeightClass="min-h-[7rem]" stackOnMobile />
      </SectionCard>
    </section>
  )
}
