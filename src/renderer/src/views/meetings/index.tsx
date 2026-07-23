import { useMemo, useState } from 'react'
import {
  AudioLinesIcon,
  Clock3Icon,
  CopyIcon,
  FileAudioIcon,
  RefreshCwIcon,
  SquareIcon,
  Trash2Icon,
  UploadIcon
} from 'lucide-react'
import { toast } from 'sonner'
import type { MeetingListItem, MeetingStatus } from '../../../../shared/meetings'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@renderer/ui/alert-dialog'
import { Badge } from '@renderer/ui/badge'
import { Button } from '@renderer/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@renderer/ui/empty'
import { Progress } from '@renderer/ui/progress'
import { Skeleton } from '@renderer/ui/skeleton'
import { cn } from '@renderer/lib/utils'
import {
  formatMeetingDate,
  formatMeetingDuration,
  formatMeetingTimestamp,
  meetingStatusLabel
} from './meeting-formatters'
import {
  useImportMeetingMutation,
  useMeetingActionMutation,
  useMeetingDetailsQuery,
  useMeetingsListQuery
} from './queries/use-meetings-queries'

const statusBadgeVariant: Record<
  MeetingStatus,
  'outline' | 'secondary' | 'success' | 'warning' | 'destructive'
> = {
  queued: 'secondary',
  processing: 'warning',
  cancelling: 'warning',
  completed: 'success',
  partial: 'warning',
  failed: 'destructive',
  cancelled: 'outline'
}

const EMPTY_MEETINGS: MeetingListItem[] = []

const getProgress = (meeting: MeetingListItem): number => {
  if (meeting.status === 'completed') {
    return 100
  }
  if (meeting.totalChunks <= 0) {
    return 0
  }
  return Math.round((meeting.completedChunks / meeting.totalChunks) * 100)
}

export function MeetingsView(): React.JSX.Element {
  const meetingsQuery = useMeetingsListQuery()
  const importMutation = useImportMeetingMutation()
  const cancelMutation = useMeetingActionMutation('cancel')
  const resumeMutation = useMeetingActionMutation('resume')
  const deleteMutation = useMeetingActionMutation('delete')
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)

  const meetings = meetingsQuery.data?.items ?? EMPTY_MEETINGS
  const effectiveSelectedMeetingId = meetings.some((meeting) => meeting.id === selectedMeetingId)
    ? selectedMeetingId
    : (meetings[0]?.id ?? null)
  const detailsQuery = useMeetingDetailsQuery(effectiveSelectedMeetingId)
  const selectedMeeting = detailsQuery.data?.meeting ?? null

  const transcriptText = useMemo(
    () => selectedMeeting?.segments.map((segment) => segment.text).join('\n\n') ?? '',
    [selectedMeeting?.segments]
  )

  const handleImport = async (): Promise<void> => {
    try {
      const response = await importMutation.mutateAsync()
      if (!response.ok) {
        if (!response.cancelled) {
          toast.error(response.message ?? 'Could not import this recording.')
        }
        return
      }

      setSelectedMeetingId(response.meeting.id)
      toast.success('Recording imported. Local transcription has started.')
    } catch {
      toast.error('Could not import this recording.')
    }
  }

  const runAction = async (
    action: 'cancel' | 'resume' | 'delete',
    meetingId: string
  ): Promise<void> => {
    try {
      const mutation =
        action === 'cancel' ? cancelMutation : action === 'resume' ? resumeMutation : deleteMutation
      const response = await mutation.mutateAsync(meetingId)
      if (!response.ok) {
        toast.error(response.message ?? `Could not ${action} this meeting.`)
        return
      }
      toast.success(
        action === 'cancel'
          ? 'Transcription will stop after the current chunk.'
          : action === 'resume'
            ? 'Transcription resumed.'
            : 'Meeting deleted.'
      )
    } catch {
      toast.error(`Could not ${action} this meeting.`)
    }
  }

  const copyTranscript = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(transcriptText)
      toast.success('Transcript copied.')
    } catch {
      toast.error('Could not copy the transcript.')
    }
  }

  return (
    <section className="w-full space-y-5 py-1 sm:py-2">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <AudioLinesIcon className="text-primary size-5" />
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Meetings</h2>
          </div>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Turn long recordings into private, on-device transcripts. Files never leave your Mac.
          </p>
        </div>
        <Button onClick={() => void handleImport()} disabled={importMutation.isPending} size="lg">
          <UploadIcon />
          {importMutation.isPending ? 'Importing…' : 'Import recording'}
        </Button>
      </header>

      {meetingsQuery.isPending ? (
        <MeetingsSkeleton />
      ) : meetings.length === 0 ? (
        <Empty className="bg-card/60 min-h-80 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileAudioIcon />
            </EmptyMedia>
            <EmptyTitle>No meeting recordings yet</EmptyTitle>
            <EmptyDescription>
              Import MP3, M4A, WAV, WebM, or a video file. OpenVocaly will process it in manageable
              chunks using your selected local model.
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => void handleImport()} disabled={importMutation.isPending}>
            <UploadIcon />
            Choose a recording
          </Button>
        </Empty>
      ) : (
        <div className="grid min-h-[32rem] gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="space-y-2">
            {meetings.map((meeting) => (
              <MeetingListButton
                key={meeting.id}
                meeting={meeting}
                selected={meeting.id === effectiveSelectedMeetingId}
                onSelect={() => setSelectedMeetingId(meeting.id)}
              />
            ))}
          </div>

          <div className="bg-card/75 min-w-0 rounded-xl border ring-1 ring-foreground/6">
            {detailsQuery.isPending || !selectedMeeting ? (
              <MeetingDetailsSkeleton />
            ) : (
              <div className="flex h-full min-h-[32rem] flex-col">
                <div className="space-y-4 border-b p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <h3 className="truncate text-lg font-semibold">{selectedMeeting.title}</h3>
                      <p className="text-muted-foreground truncate text-xs">
                        {selectedMeeting.sourceFileName}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(selectedMeeting.status === 'queued' ||
                        selectedMeeting.status === 'processing') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void runAction('cancel', selectedMeeting.id)}
                          disabled={cancelMutation.isPending}
                        >
                          <SquareIcon />
                          Cancel
                        </Button>
                      )}
                      {(selectedMeeting.status === 'failed' ||
                        selectedMeeting.status === 'partial' ||
                        selectedMeeting.status === 'cancelled') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void runAction('resume', selectedMeeting.id)}
                          disabled={resumeMutation.isPending}
                        >
                          <RefreshCwIcon />
                          Resume
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void copyTranscript()}
                        disabled={!transcriptText}
                      >
                        <CopyIcon />
                        Copy
                      </Button>
                      <DeleteMeetingButton
                        disabled={
                          selectedMeeting.status === 'queued' ||
                          selectedMeeting.status === 'processing' ||
                          selectedMeeting.status === 'cancelling' ||
                          deleteMutation.isPending
                        }
                        onDelete={() => void runAction('delete', selectedMeeting.id)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusBadgeVariant[selectedMeeting.status]} size="md">
                      {meetingStatusLabel[selectedMeeting.status]}
                    </Badge>
                    <Badge variant="outline" size="md">
                      <Clock3Icon />
                      {formatMeetingDuration(selectedMeeting.durationMs)}
                    </Badge>
                    <Badge variant="outline" size="md">
                      {selectedMeeting.modelId}
                    </Badge>
                  </div>

                  {(selectedMeeting.status === 'queued' ||
                    selectedMeeting.status === 'processing' ||
                    selectedMeeting.status === 'cancelling') && (
                    <div className="space-y-1.5">
                      <div className="text-muted-foreground flex justify-between text-xs">
                        <span>
                          {selectedMeeting.totalChunks === 0
                            ? 'Preparing audio chunks'
                            : `Chunk ${Math.min(
                                selectedMeeting.completedChunks + 1,
                                selectedMeeting.totalChunks
                              )} of ${selectedMeeting.totalChunks}`}
                        </span>
                        <span>{getProgress(selectedMeeting)}%</span>
                      </div>
                      <Progress value={getProgress(selectedMeeting)} />
                    </div>
                  )}

                  {selectedMeeting.errorMessage && (
                    <p className="text-destructive text-sm">{selectedMeeting.errorMessage}</p>
                  )}
                </div>

                <div className="min-h-0 flex-1 space-y-5 p-4 sm:p-5">
                  {selectedMeeting.segments.length === 0 ? (
                    <div className="text-muted-foreground flex min-h-48 flex-col items-center justify-center gap-2 text-center text-sm">
                      <AudioLinesIcon className="size-5" />
                      <p>
                        {selectedMeeting.status === 'processing' ||
                        selectedMeeting.status === 'cancelling'
                          ? 'The first transcript section will appear here when it is ready.'
                          : 'No transcript sections are available yet.'}
                      </p>
                    </div>
                  ) : (
                    selectedMeeting.segments.map((segment) => (
                      <article
                        key={segment.id}
                        className="grid gap-2 sm:grid-cols-[5.25rem_minmax(0,1fr)]"
                      >
                        <time className="text-primary pt-0.5 font-mono text-xs font-medium tabular-nums">
                          {formatMeetingTimestamp(segment.startMs)}
                        </time>
                        <p className="text-sm leading-6 whitespace-pre-wrap">{segment.text}</p>
                      </article>
                    ))
                  )}
                </div>

                <footer className="text-muted-foreground border-t px-4 py-3 text-xs sm:px-5">
                  Imported {formatMeetingDate(selectedMeeting.createdAt)} · Stored and processed
                  locally
                </footer>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function MeetingListButton({
  meeting,
  selected,
  onSelect
}: {
  meeting: MeetingListItem
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-xl border p-3 text-left ring-1 transition-colors cursor-pointer',
        selected
          ? 'border-primary/30 bg-primary/6 ring-primary/15'
          : 'bg-card/70 ring-foreground/5 hover:bg-muted/60'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-medium">{meeting.title}</p>
        <Badge variant={statusBadgeVariant[meeting.status]}>
          {meetingStatusLabel[meeting.status]}
        </Badge>
      </div>
      <div className="text-muted-foreground mt-2 flex items-center justify-between gap-2 text-xs">
        <span>{formatMeetingDuration(meeting.durationMs)}</span>
        <span>{formatMeetingDate(meeting.createdAt).split(',')[0]}</span>
      </div>
      {(meeting.status === 'queued' ||
        meeting.status === 'processing' ||
        meeting.status === 'cancelling') && (
        <Progress className="mt-2" value={getProgress(meeting)} />
      )}
    </button>
  )
}

function DeleteMeetingButton({
  disabled,
  onDelete
}: {
  disabled: boolean
  onDelete: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)

  const handleDelete = (): void => {
    setOpen(false)
    onDelete()
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="sm" disabled={disabled}>
            <Trash2Icon />
            <span className="sr-only">Delete meeting</span>
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this meeting?</AlertDialogTitle>
          <AlertDialogDescription>
            The managed recording and its local transcript will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep meeting</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleDelete}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function MeetingsSkeleton(): React.JSX.Element {
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="space-y-2">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="min-h-[32rem] rounded-xl" />
    </div>
  )
}

function MeetingDetailsSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-5 p-5">
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}
