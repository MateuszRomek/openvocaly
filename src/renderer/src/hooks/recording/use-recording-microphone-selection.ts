import { useCallback, useMemo } from 'react'
import {
  canEnumerateMicrophoneDevices,
  type MicrophoneDeviceOption
} from '@renderer/capture/microphone-devices'
import { isMicrophoneSelectionBlocked } from '@renderer/helpers/microphone-permission'
import {
  resolveDevicesErrorMessage,
  toSelectableDeviceOptions
} from '@renderer/helpers/recording-microphone-selection'
import { usePermissionsStatusQuery } from '@renderer/queries/permissions/use-permissions-status-query'
import { useMicrophoneDevicesQuery } from '@renderer/queries/recording/use-microphone-devices-query'
import { usePersistResolvedMicrophoneSelection } from './use-persist-resolved-microphone-selection'
import { useRecordingPreferences } from './use-recording-preferences'

type UseRecordingMicrophoneSelectionResult = {
  isLoading: boolean
  requestError: string | null
  devicesError: string | null
  isDeviceEnumerationAvailable: boolean
  isPermissionBlocked: boolean
  permissionMessage?: string
  hasNoDevices: boolean
  deviceOptions: MicrophoneDeviceOption[]
  selectedOptionId: string | null
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
  const permissionsStatusQuery = usePermissionsStatusQuery()
  const isPermissionStatusLoading = permissionsStatusQuery.isPending

  const microphonePermissionState = permissionsStatusQuery.data?.microphone.state ?? 'unknown'
  const isPermissionBlocked = isMicrophoneSelectionBlocked(microphonePermissionState)
  const isDeviceEnumerationAvailable = canEnumerateMicrophoneDevices()

  const devicesQuery = useMicrophoneDevicesQuery({ preferredDeviceId: selectedMicrophoneDeviceId })

  const allDeviceOptions = devicesQuery.data?.devices
  const resolvedDeviceId = devicesQuery.data?.resolvedDeviceId ?? null
  const selectableDeviceOptions = useMemo(
    () => toSelectableDeviceOptions(allDeviceOptions),
    [allDeviceOptions]
  )
  const canPersistResolvedSelection =
    !isPermissionBlocked &&
    !isPermissionStatusLoading &&
    microphonePermissionState === 'granted' &&
    !isPreferencesLoading &&
    !isMutating &&
    !devicesQuery.isPending

  usePersistResolvedMicrophoneSelection({
    canPersistResolvedSelection,
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
    permissionMessage: permissionsStatusQuery.data?.microphone.message,
    hasNoDevices: !devicesQuery.isPending && selectableDeviceOptions.length === 0,
    deviceOptions: selectableDeviceOptions,
    selectedOptionId: selectedOption?.optionId ?? null,
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
