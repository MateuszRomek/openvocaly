import type { UseQueryResult } from '@tanstack/react-query'
import type { MicrophoneDeviceOption } from '@renderer/capture/microphone-devices'
import { RECORDING_COPY } from '@renderer/constants/recording'

const EMPTY_MICROPHONE_OPTIONS: MicrophoneDeviceOption[] = []

export const toSelectableDeviceOptions = (
  devices: MicrophoneDeviceOption[] | undefined
): MicrophoneDeviceOption[] =>
  (devices ?? EMPTY_MICROPHONE_OPTIONS).filter((device) => device.deviceId !== null)

export const resolveDevicesErrorMessage = (
  query: UseQueryResult<{ devices: MicrophoneDeviceOption[]; resolvedDeviceId: string | null }>
): string | null => {
  if (!query.isError) {
    return null
  }

  return RECORDING_COPY.errors.loadMicrophones
}
