export const shortcutsKeys = {
  all: ['shortcuts'] as const,
  config: () => [...shortcutsKeys.all, 'config'] as const,
  runtimeStatus: () => [...shortcutsKeys.all, 'runtimeStatus'] as const
}
