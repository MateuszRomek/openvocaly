import { useCallback, useMemo } from 'react'
import {
  canEnumerateMicrophoneDevices,
  type MicrophoneDeviceOption
} from '@renderer/capture/microphone-devices'
import { useRecordingPreferences } from './use-recording-preferences'
import { usePermissions } from './use-permissions'
import { usePersistResolvedMicrophoneSelection } from './use-persist-resolved-microphone-selection'
import { isMicrophoneSelectionBlocked } from '../helpers/microphone-permission'
import {
  resolveDevicesErrorMessage,
  toSelectableDeviceOptions
} from '../helpers/recording-microphone-selection'
import { useMicrophoneDevicesQuery } from '../queries/recording/use-microphone-devices-query'

type UseRecordingMicrophoneSelectionResult = {
  isLoading: boolean
  requestError: string | null
  devicesError: string | null
  isDeviceEnumerationAvailable: boolean
  isPermissionBlocked: boolean
  permissionMessage?: string
  hasNoDevices: boolean
  deviceOptions: MicrophoneDeviceOption[]
  selectedOptionId: string | undefined
  selectedLabel: string | null
  selectDisabled: boolean
  handleValueChange: (value: string | null) => void
}

export function useRecordingMicrophoneSelection(): UseRecordingMicrophoneSelectionResult {
  const {
    isLoading: isPreferencesLoading,
    isMutating,
    requestError,
    selectedMicrophoneDeviceId,
    setSelectedMicrophoneDeviceId
  } = useRecordingPreferences()
  const { permissionConfig, isLoading: isPermissionStatusLoading } = usePermissions()

  const microphonePermissionState = permissionConfig.microphone.state
  const isPermissionBlocked = isMicrophoneSelectionBlocked(microphonePermissionState)
  const isDeviceEnumerationAvailable = canEnumerateMicrophoneDevices()

  const devicesQuery = useMicrophoneDevicesQuery({ preferredDeviceId: selectedMicrophoneDeviceId })

  const allDeviceOptions = devicesQuery.data?.devices
  const resolvedDeviceId = devicesQuery.data?.resolvedDeviceId ?? null
  const selectableDeviceOptions = useMemo(
    () => toSelectableDeviceOptions(allDeviceOptions),
    [allDeviceOptions]
  )

  usePersistResolvedMicrophoneSelection({
    isPermissionBlocked,
    isPreferencesLoading,
    isMutating,
    isDevicesLoading: devicesQuery.isPending,
    resolvedDeviceId,
    selectedMicrophoneDeviceId,
    setSelectedMicrophoneDeviceId
  })

  const selectedOption = useMemo(() => {
    const explicitSelection = selectableDeviceOptions.find(
      (device) => device.deviceId === selectedMicrophoneDeviceId
    )

    return explicitSelection ?? selectableDeviceOptions[0]
  }, [selectableDeviceOptions, selectedMicrophoneDeviceId])

  const handleValueChange = useCallback(
    (value: string | null): void => {
      if (!value) {
        return
      }

      const selectedDevice = selectableDeviceOptions.find((device) => device.optionId === value)
      const nextDeviceId = selectedDevice?.deviceId ?? null

      if (!nextDeviceId || nextDeviceId === selectedMicrophoneDeviceId) {
        return
      }

      setSelectedMicrophoneDeviceId(nextDeviceId)
    },
    [selectableDeviceOptions, selectedMicrophoneDeviceId, setSelectedMicrophoneDeviceId]
  )

  return {
    isLoading: isPreferencesLoading,
    requestError,
    devicesError: resolveDevicesErrorMessage(devicesQuery),
    isDeviceEnumerationAvailable,
    isPermissionBlocked,
    permissionMessage: permissionConfig.microphone.message,
    hasNoDevices: !devicesQuery.isPending && selectableDeviceOptions.length === 0,
    deviceOptions: selectableDeviceOptions,
    selectedOptionId: selectedOption?.optionId,
    selectedLabel: selectedOption?.label ?? null,
    selectDisabled:
      isPermissionBlocked ||
      isPermissionStatusLoading ||
      isMutating ||
      devicesQuery.isPending ||
      selectableDeviceOptions.length === 0,
    handleValueChange
  }
}
