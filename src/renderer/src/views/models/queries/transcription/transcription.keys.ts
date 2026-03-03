export const transcriptionKeys = {
  all: ['transcription'] as const,
  preferences: () => [...transcriptionKeys.all, 'preferences'] as const
}
