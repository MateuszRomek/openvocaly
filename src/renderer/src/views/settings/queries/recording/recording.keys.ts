export const recordingKeys = {
  all: ['recording'] as const,
  preferences: () => [...recordingKeys.all, 'preferences'] as const,
  microphoneDevices: (preferredDeviceId: string | null) =>
    [...recordingKeys.all, 'microphoneDevices', preferredDeviceId ?? 'none'] as const
}
