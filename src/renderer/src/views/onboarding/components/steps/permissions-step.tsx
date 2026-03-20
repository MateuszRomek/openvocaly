import { useMemo } from 'react'
import { AlertTriangleIcon, CheckCircle2Icon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import { Button } from '@renderer/ui/button'
import { useRecordingMicrophoneSelection } from '@renderer/hooks/recording/use-recording-microphone-selection'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from '@renderer/ui/select'
import { useOnboardingStepNavigation } from '../../hooks/use-onboarding-step-navigation'
import { usePermissionsStep } from '../../hooks/steps/use-permissions-step'

export function PermissionsStep(): React.JSX.Element {
  const {
    accessibilityReady,
    accessibilityUnsupported,
    isComplete,
    isMacOS,
    loading,
    message,
    microphoneGranted,
    microphoneReady,
    microphoneUnsupported,
    openAccessibilitySettings,
    openMicrophoneSettings,
    requestAccessibility,
    requestMicrophone,
    showPlatformNotice
  } = usePermissionsStep()
  const {
    isLoading: isMicrophoneSelectionLoading,
    requestError: microphoneRequestError,
    devicesError: microphoneDevicesError,
    isDeviceEnumerationAvailable,
    hasNoDevices,
    deviceOptions,
    selectedOptionId,
    selectedLabel,
    selectDisabled,
    handleValueChange
  } = useRecordingMicrophoneSelection()

  const navigationState = useMemo(
    () => ({
      canContinue: isComplete,
      isBusy: loading,
      continueDisabledHint: 'Enable all permissions to continue.'
    }),
    [isComplete, loading]
  )

  useOnboardingStepNavigation(navigationState)

  const settingsHelperCopy = 'Enable OpenVocally in System Settings, then return to the app.'
  const microphoneSelectionError = microphoneRequestError ?? microphoneDevicesError
  const microphoneSelectionErrorTitle = microphoneRequestError
    ? 'Could not save input device'
    : 'Could not load input devices'

  const handleMicrophoneAllowAccess = (): void => {
    requestMicrophone()
    if (isMacOS) {
      window.setTimeout(() => {
        openMicrophoneSettings()
      }, 180)
    }
  }

  const handleAccessibilityAllowAccess = (): void => {
    requestAccessibility()
    if (isMacOS) {
      window.setTimeout(() => {
        openAccessibilitySettings()
      }, 180)
    }
  }

  return (
    <div className="w-full space-y-4">
      {message ? (
        <Alert variant="destructive">
          <AlertTitle>Permission check failed</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {isComplete ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/6 px-4 py-2.5">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-200">
            <CheckCircle2Icon className="size-4 text-emerald-400" />
            You are all set. Required permissions are enabled.
          </p>
        </div>
      ) : null}

      {showPlatformNotice ? (
        <Alert>
          <AlertTitle>Platform-specific flow</AlertTitle>
          <AlertDescription>
            Permission prompts differ on this platform. Continue, then review OS-specific details in
            Settings.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-border/65 bg-background/65 p-5">
          <div className="space-y-1.5">
            <p className="text-base font-semibold">Microphone</p>
            <p className="text-muted-foreground text-sm">Required to capture speech input.</p>
          </div>

          {microphoneReady ? (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/18 bg-emerald-500/5 px-2.5 py-1 text-xs font-medium text-emerald-200/95">
              <CheckCircle2Icon className="size-3.5 text-emerald-400/90" />
              {microphoneUnsupported ? 'Handled on this platform' : 'Enabled'}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Button
                size="sm"
                variant="outline"
                className="bg-background/75 hover:bg-background/90"
                onClick={handleMicrophoneAllowAccess}
              >
                Allow access
              </Button>
              {isMacOS ? (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {settingsHelperCopy}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-border/65 bg-background/65 p-5">
          <div className="space-y-1.5">
            <p className="text-base font-semibold">Accessibility / Input</p>
            <p className="text-muted-foreground text-sm">
              Required to insert text into other apps.
            </p>
          </div>

          {accessibilityReady ? (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/18 bg-emerald-500/5 px-2.5 py-1 text-xs font-medium text-emerald-200/95">
              <CheckCircle2Icon className="size-3.5 text-emerald-400/90" />
              {accessibilityUnsupported ? 'Handled on this platform' : 'Enabled'}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Button
                size="sm"
                variant="outline"
                className="bg-background/75 hover:bg-background/90"
                onClick={handleAccessibilityAllowAccess}
              >
                Allow access
              </Button>
              {isMacOS ? (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {settingsHelperCopy}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {microphoneGranted ? (
        <div className="space-y-4 rounded-2xl border border-border/65 bg-background/65 p-5">
          <div className="space-y-1.5">
            <p className="text-base font-semibold">Input device</p>
            <p className="text-muted-foreground text-sm">
              Choose which microphone OpenVocally uses for dictation.
            </p>
          </div>

          {microphoneSelectionError ? (
            <Alert variant="destructive">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
              <AlertTitle>{microphoneSelectionErrorTitle}</AlertTitle>
              <AlertDescription>{microphoneSelectionError}</AlertDescription>
            </Alert>
          ) : null}

          {!isDeviceEnumerationAvailable ? (
            <p className="text-muted-foreground text-xs">
              Microphone list is not available in this environment.
            </p>
          ) : null}
          {!isMicrophoneSelectionLoading && hasNoDevices ? (
            <p className="text-muted-foreground text-xs">No input devices available.</p>
          ) : null}

          <div className="w-full max-w-sm">
            <Select
              value={selectedOptionId}
              onValueChange={handleValueChange}
              disabled={selectDisabled}
            >
              <SelectTrigger className="w-full" aria-label="Onboarding microphone device">
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
        </div>
      ) : null}
    </div>
  )
}
