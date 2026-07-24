export const meetingsKeys = {
  all: ['meetings'] as const,
  list: () => [...meetingsKeys.all, 'list'] as const,
  detail: (meetingId: string | null) => [...meetingsKeys.all, 'detail', meetingId] as const
}
