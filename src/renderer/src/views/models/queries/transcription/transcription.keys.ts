export const transcriptionKeys = {
  all: ['transcription'] as const,
  preferences: () => [...transcriptionKeys.all, 'preferences'] as const,
  localModels: (providerId: string) => [...transcriptionKeys.all, 'local-models', providerId] as const,
  localRuntimeStatus: (providerId: string) =>
    [...transcriptionKeys.all, 'local-runtime-status', providerId] as const
}
