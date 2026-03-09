const SYNTHETIC_AUDIO_INPUT_DEVICE_IDS = new Set(['default', 'communications'])
const OPAQUE_DEVICE_LABEL_PATTERN = /^[a-z0-9_-]{20,}$/i

export type MicrophoneDeviceOption = {
  optionId: string
  deviceId: string | null
  label: string
}

export type MicrophoneDeviceResolution = {
  devices: MicrophoneDeviceOption[]
  resolvedDeviceId: string | null
}

const toAudioInputCandidates = (devices: MediaDeviceInfo[]): MediaDeviceInfo[] => {
  return devices.filter((device) => device.kind === 'audioinput')
}

const toMicrophoneLabel = (label: string, index: number, deviceId: string): string => {
  const trimmed = label.trim()
  const looksLikeOpaqueDeviceId =
    OPAQUE_DEVICE_LABEL_PATTERN.test(trimmed) && !trimmed.includes(' ')

  if (!trimmed || trimmed === deviceId || looksLikeOpaqueDeviceId) {
    return `Microphone ${index + 1}`
  }

  return trimmed
}

const resolveOptionId = (device: MediaDeviceInfo, index: number): string => {
  if (device.deviceId.length > 0) {
    return `device:${device.deviceId}`
  }

  const groupIdPart = device.groupId.trim().length > 0 ? device.groupId : 'nogroup'
  return `unstable:${groupIdPart}:${index}`
}

const toUniqueOptions = (devices: MediaDeviceInfo[]): MicrophoneDeviceOption[] => {
  const seenOptionIds = new Set<string>()
  const options: MicrophoneDeviceOption[] = []

  devices.forEach((device, index) => {
    const optionId = resolveOptionId(device, index)

    if (seenOptionIds.has(optionId)) {
      return
    }

    seenOptionIds.add(optionId)
    options.push({
      optionId,
      deviceId: device.deviceId.length > 0 ? device.deviceId : null,
      label: toMicrophoneLabel(device.label, options.length, device.deviceId)
    })
  })

  return options
}

export const canEnumerateMicrophoneDevices = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.enumerateDevices === 'function'

export const resolvePreferredMicrophoneDevice = async (
  preferredDeviceId: string | null
): Promise<MicrophoneDeviceResolution> => {
  if (!canEnumerateMicrophoneDevices()) {
    return {
      devices: [],
      resolvedDeviceId: null
    }
  }

  const devices = await navigator.mediaDevices.enumerateDevices()
  const microphoneOptions = toUniqueOptions(toAudioInputCandidates(devices))
  const addressableOptions: MicrophoneDeviceOption[] = []
  const concreteAddressableOptions: MicrophoneDeviceOption[] = []

  for (const device of microphoneOptions) {
    if (typeof device.deviceId !== 'string' || device.deviceId.length === 0) {
      continue
    }

    addressableOptions.push(device)

    if (!SYNTHETIC_AUDIO_INPUT_DEVICE_IDS.has(device.deviceId)) {
      concreteAddressableOptions.push(device)
    }
  }

  const fallbackCandidates =
    concreteAddressableOptions.length > 0 ? concreteAddressableOptions : addressableOptions
  const defaultAddressableOption = addressableOptions.find((device) => device.deviceId === 'default')
  const communicationsAddressableOption = addressableOptions.find(
    (device) => device.deviceId === 'communications'
  )
  const hasPreferredDevice =
    typeof preferredDeviceId === 'string' &&
    addressableOptions.some((device) => device.deviceId === preferredDeviceId)

  const resolvedDeviceId = hasPreferredDevice
    ? preferredDeviceId
    : (defaultAddressableOption?.deviceId ??
      communicationsAddressableOption?.deviceId ??
      fallbackCandidates[0]?.deviceId ??
      null)

  return {
    devices: microphoneOptions,
    resolvedDeviceId
  }
}
