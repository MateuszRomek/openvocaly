import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type {
  GetMeetingResponse,
  ImportMeetingResponse,
  ListMeetingsResponse,
  MeetingActionResponse
} from '../../../../../shared/meetings'
import { meetingsKeys } from './meetings.keys'

const ACTIVE_STATUSES = new Set(['queued', 'processing', 'cancelling'])

export function useMeetingsListQuery(): UseQueryResult<ListMeetingsResponse, Error> {
  return useQuery({
    queryKey: meetingsKeys.list(),
    queryFn: async () => await window.api.meetings.list(),
    refetchInterval: (query) => {
      const hasActiveMeeting = query.state.data?.items.some((item) =>
        ACTIVE_STATUSES.has(item.status)
      )
      return hasActiveMeeting ? 1_500 : false
    },
    refetchOnMount: 'always'
  })
}

export function useMeetingDetailsQuery(
  meetingId: string | null
): UseQueryResult<GetMeetingResponse, Error> {
  return useQuery({
    queryKey: meetingsKeys.detail(meetingId),
    queryFn: async () => {
      if (!meetingId) {
        return { meeting: null }
      }
      return await window.api.meetings.get({ meetingId })
    },
    enabled: Boolean(meetingId),
    refetchInterval: (query) => {
      const status = query.state.data?.meeting?.status
      return status && ACTIVE_STATUSES.has(status) ? 1_500 : false
    }
  })
}

export function useImportMeetingMutation(): UseMutationResult<ImportMeetingResponse, Error, void> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => await window.api.meetings.selectAndImport(),
    onSuccess: async (response) => {
      if (response.ok) {
        await queryClient.invalidateQueries({ queryKey: meetingsKeys.all })
      }
    }
  })
}

export function useMeetingActionMutation(
  action: 'cancel' | 'resume' | 'delete'
): UseMutationResult<MeetingActionResponse, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (meetingId: string) =>
      await window.api.meetings[action]({
        meetingId
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: meetingsKeys.all })
    }
  })
}
