import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import {
  canEnumerateMicrophoneDevices,
  resolvePreferredMicrophoneDevice,
  type MicrophoneDeviceOption
} from '@renderer/capture/microphone-devices'
import { recordingKeys } from './recording.keys'

export type MicrophoneDevicesResponse = {
  devices: MicrophoneDeviceOption[]
  resolvedDeviceId: string | null
}

type UseMicrophoneDevicesQueryInput = {
  preferredDeviceId: string | null
}

export function useMicrophoneDevicesQuery({
  preferredDeviceId
}: UseMicrophoneDevicesQueryInput): UseQueryResult<MicrophoneDevicesResponse> {
  const query = useQuery({
    queryKey: recordingKeys.microphoneDevices(preferredDeviceId),
    queryFn: async (): Promise<MicrophoneDevicesResponse> => {
      if (!canEnumerateMicrophoneDevices()) {
        return {
          devices: [],
          resolvedDeviceId: null
        }
      }

      const resolution = await resolvePreferredMicrophoneDevice(preferredDeviceId)

      return {
        devices: resolution.devices,
        resolvedDeviceId: resolution.resolvedDeviceId
      }
    }
  })
  const { refetch } = query

  useEffect(() => {
    if (!canEnumerateMicrophoneDevices()) {
      return
    }

    const handleDeviceChange = (): void => {
      void refetch()
    }

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [refetch])

  return query
}
