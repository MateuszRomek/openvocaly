import type { UseQueryResult } from '@tanstack/react-query'
import type { MicrophoneDeviceOption } from '@renderer/capture/microphone-devices'
import { SETTINGS_COPY } from '../constants/copy'

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

  return SETTINGS_COPY.errors.loadMicrophones
}
