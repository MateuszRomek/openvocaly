export const permissionsKeys = {
  all: ['permissions'] as const,
  status: () => [...permissionsKeys.all, 'status'] as const
}
