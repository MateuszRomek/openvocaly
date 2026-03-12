export const transcriptsKeys = {
  all: ['transcripts'] as const,
  lists: () => [...transcriptsKeys.all, 'list'] as const,
  list: (page: number) => [...transcriptsKeys.lists(), page] as const
}
