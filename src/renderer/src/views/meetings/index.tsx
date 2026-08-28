import { useEffect, useMemo, useState } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import {
  AlertCircleIcon,
  AudioLinesIcon,
  ChevronRightIcon,
  CopyIcon,
  FileAudioIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  SearchIcon,
  SquareIcon,
  Trash2Icon,
  UploadIcon,
  XIcon
} from 'lucide-react'
import { toast } from 'sonner'
import type {
  GetMeetingResponse,
  MeetingDetails,
  MeetingImportSelection,
  MeetingListItem,
  MeetingStatus
} from '../../../../shared/meetings'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/ui/alert-dialog'
import { Button } from '@renderer/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/ui/dropdown-menu'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from '@renderer/ui/drawer'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@renderer/ui/empty'
import { Badge } from '@renderer/ui/badge'
import { Input } from '@renderer/ui/input'
import { Skeleton } from '@renderer/ui/skeleton'
import { Spinner } from '@renderer/ui/spinner'
import { cn } from '@renderer/lib/utils'
import {
  formatMeetingDuration,
  formatMeetingElapsed,
  formatMeetingListDate,
  formatMeetingModelLabel,
  formatMeetingTitle,
  formatMeetingTimestamp,
  meetingStatusLabel
} from './meeting-formatters'
import {
  useImportMeetingMutation,
  useMeetingActionMutation,
  useMeetingDetailsQuery,
  useMeetingsListQuery
} from './queries/use-meetings-queries'
import { MeetingImportDialog } from './components/meeting-import-dialog'

const statusIndicatorClass: Record<MeetingStatus, string> = {
  queued: 'bg-muted-foreground',
  processing: 'bg-primary',
  cancelling: 'bg-warning',
  completed: 'bg-success',
  partial: 'bg-warning',
  failed: 'bg-destructive',
  cancelled: 'bg-muted-foreground'
}

const ACTIVE_STATUSES: ReadonlySet<MeetingStatus> = new Set(['queued', 'processing', 'cancelling'])
const READY_STATUSES: ReadonlySet<MeetingStatus> = new Set(['completed'])
const ATTENTION_STATUSES: ReadonlySet<MeetingStatus> = new Set(['partial', 'failed', 'cancelled'])

const EMPTY_MEETINGS: MeetingListItem[] = []

type MeetingFilter = 'all' | 'active' | 'ready' | 'attention'

export function MeetingsView(): React.JSX.Element {
  const meetingsQuery = useMeetingsListQuery()
  const importMutation = useImportMeetingMutation()
  const cancelMutation = useMeetingActionMutation('cancel')
  const resumeMutation = useMeetingActionMutation('resume')
  const deleteMutation = useMeetingActionMutation('delete')
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<MeetingFilter>('all')
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const meetings = meetingsQuery.data?.items ?? EMPTY_MEETINGS
  const searchQuery = search.trim().toLocaleLowerCase()
  const hasActiveMeetings = meetings.some((meeting) => ACTIVE_STATUSES.has(meeting.status))

  useEffect(() => {
    if (!hasActiveMeetings) {
      return
    }

    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [hasActiveMeetings])

  const filteredMeetings = useMemo(() => {
    return meetings.filter((meeting) => {
      const matchesSearch =
        searchQuery.length === 0 ||
        `${meeting.title} ${meeting.sourceFileName}`.toLocaleLowerCase().includes(searchQuery)
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && ACTIVE_STATUSES.has(meeting.status)) ||
        (filter === 'ready' && READY_STATUSES.has(meeting.status)) ||
        (filter === 'attention' && ATTENTION_STATUSES.has(meeting.status))

      return matchesSearch && matchesFilter
    })
  }, [filter, meetings, searchQuery])

  const isTranscriptDrawerOpen = selectedMeetingId !== null
  const detailsQuery = useMeetingDetailsQuery(isTranscriptDrawerOpen ? selectedMeetingId : null)
  const selectedMeeting = detailsQuery.data?.meeting ?? null

  const transcriptText = useMemo(
    () => selectedMeeting?.segments.map((segment) => segment.text).join('\n\n') ?? '',
    [selectedMeeting?.segments]
  )

  const handleImport = async (selection: MeetingImportSelection): Promise<void> => {
    try {
      const response = await importMutation.mutateAsync(selection)
      if (!response.ok) {
        if (!response.cancelled) {
          toast.error(response.message ?? 'Could not import this recording.')
        }
        return
      }

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
      if (action === 'delete') {
        setSelectedMeetingId(null)
      }
      toast.success(
        action === 'cancel'
          ? 'Transcription cancelled. Restart it anytime.'
          : action === 'resume'
            ? 'Transcription restarted.'
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

  const clearFilters = (): void => {
    setSearch('')
    setFilter('all')
  }

  const shouldShowToolbar = meetings.length > 1 || searchQuery.length > 0 || filter !== 'all'

  const openMeeting = (meeting: MeetingListItem): void => {
    if (ACTIVE_STATUSES.has(meeting.status)) {
      return
    }

    setSelectedMeetingId(meeting.id)
  }

  const closeMeeting = (open: boolean): void => {
    if (!open) {
      setSelectedMeetingId(null)
    }
  }

  return (
    <section className="w-full max-w-4xl space-y-6 py-1 sm:space-y-7 sm:py-2">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Meetings
            </h2>
            <Badge
              variant="outline"
              className="h-5 border-sky-500/30 bg-sky-500/10 px-2 text-[11px] font-semibold uppercase text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-300"
            >
              Beta
            </Badge>
          </div>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Local recordings and transcripts, processed on this Mac.
          </p>
        </div>
        {meetings.length > 0 && (
          <Button
            type="button"
            onClick={() => setIsImportDialogOpen(true)}
            disabled={importMutation.isPending}
            size="lg"
            className="touch-manipulation"
          >
            {importMutation.isPending ? (
              <Spinner aria-hidden="true" />
            ) : (
              <UploadIcon aria-hidden="true" />
            )}
            {importMutation.isPending ? 'Importing…' : 'Import recording'}
          </Button>
        )}
      </header>

      {meetingsQuery.isError ? (
        <MeetingErrorState
          isRetrying={meetingsQuery.isRefetching}
          onRetry={() => void meetingsQuery.refetch()}
        />
      ) : meetingsQuery.isPending ? (
        <MeetingsSkeleton />
      ) : meetings.length === 0 ? (
        <MeetingLibraryEmptyState
          isImporting={importMutation.isPending}
          onImport={() => setIsImportDialogOpen(true)}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          {shouldShowToolbar && (
            <MeetingToolbar
              filter={filter}
              search={search}
              onFilterChange={setFilter}
              onSearchChange={setSearch}
              onClearSearch={() => setSearch('')}
            />
          )}

          {filteredMeetings.length === 0 ? (
            <FilteredMeetingsEmptyState hasSearch={searchQuery.length > 0} onClear={clearFilters} />
          ) : (
            <div className="p-2.5 sm:p-3">
              <div className="mb-2 px-2 py-1">
                <h3 id="meeting-recordings-heading" className="text-sm font-semibold">
                  Recordings
                </h3>
              </div>

              <ul className="space-y-0.5" aria-label="Meeting recordings">
                {filteredMeetings.map((meeting) => (
                  <li key={meeting.id} className="[content-visibility:auto]">
                    <MeetingListButton
                      meeting={meeting}
                      selected={meeting.id === selectedMeetingId}
                      cancelPendingMeetingId={
                        cancelMutation.isPending ? (cancelMutation.variables ?? null) : null
                      }
                      now={now}
                      onCancel={() => void runAction('cancel', meeting.id)}
                      onSelect={() => openMeeting(meeting)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <MeetingTranscriptDrawer
        open={isTranscriptDrawerOpen}
        onOpenChange={closeMeeting}
        detailsQuery={detailsQuery}
        onAction={runAction}
        onCopy={() => void copyTranscript()}
        onRetry={() => void detailsQuery.refetch()}
        resumePending={resumeMutation.isPending}
        deleteDisabled={deleteMutation.isPending}
        selectedMeeting={selectedMeeting}
        transcriptText={transcriptText}
      />

      <MeetingImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onSubmit={(selection) => void handleImport(selection)}
      />
    </section>
  )
}

function MeetingToolbar({
  filter,
  search,
  onFilterChange,
  onSearchChange,
  onClearSearch
}: {
  filter: MeetingFilter
  search: string
  onFilterChange: (filter: MeetingFilter) => void
  onSearchChange: (search: string) => void
  onClearSearch: () => void
}): React.JSX.Element {
  const filterOptions: Array<{ value: MeetingFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'In progress' },
    { value: 'ready', label: 'Ready' },
    { value: 'attention', label: 'Needs attention' }
  ]

  return (
    <div className="flex flex-col gap-2.5 border-b px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <label htmlFor="meeting-search" className="sr-only">
          Search recordings
        </label>
        <SearchIcon
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          id="meeting-search"
          name="meeting-search"
          type="search"
          autoComplete="off"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search recordings…"
          className="pr-9 pl-9"
        />
        {search.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Clear search"
            onClick={onClearSearch}
            className="absolute top-1/2 right-1 -translate-y-1/2"
          >
            <XIcon aria-hidden="true" />
          </Button>
        )}
      </div>

      <div
        className="flex items-center gap-2 overflow-x-auto"
        role="group"
        aria-label="Filter recordings"
      >
        <span className="text-muted-foreground shrink-0 text-xs font-medium">Filter</span>
        <div className="bg-muted/60 flex shrink-0 rounded-lg p-0.5">
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={filter === option.value ? 'secondary' : 'ghost'}
              size="xs"
              aria-pressed={filter === option.value}
              onClick={() => onFilterChange(option.value)}
              className="touch-manipulation rounded-md"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

function MeetingListButton({
  cancelPendingMeetingId,
  meeting,
  now,
  onCancel,
  selected,
  onSelect
}: {
  cancelPendingMeetingId: string | null
  meeting: MeetingListItem
  now: number
  onCancel: () => void
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  const canOpen = !ACTIVE_STATUSES.has(meeting.status)
  const canCancel = meeting.status === 'queued' || meeting.status === 'processing'
  const isStopping = meeting.status === 'cancelling' || cancelPendingMeetingId === meeting.id
  const showStopAction = canCancel || isStopping
  const progressValue = getMeetingProgressValue(meeting)
  const progressLabel = getMeetingProgressLabel(meeting, now, progressValue)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onSelect}
        disabled={!canOpen}
        aria-disabled={!canOpen}
        aria-haspopup={canOpen ? 'dialog' : undefined}
        aria-expanded={canOpen ? selected : undefined}
        className={cn(
          'group/meeting relative flex min-h-16 w-full items-center gap-3 rounded-lg px-3 py-3 pr-14 text-left transition-[background-color,color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none touch-manipulation',
          canOpen ? (selected ? 'bg-primary/8' : 'hover:bg-muted/60') : 'cursor-default opacity-90'
        )}
      >
        {selected && (
          <span
            aria-hidden="true"
            className="bg-primary absolute inset-y-2 left-0 w-0.5 rounded-full"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="min-w-0 truncate text-sm font-medium">
            {formatMeetingTitle(meeting.title)}
          </p>
          <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
            {meeting.durationMs ? <span>{formatMeetingDuration(meeting.durationMs)}</span> : null}
            {meeting.durationMs ? (
              <span aria-hidden="true" className="text-border">
                ·
              </span>
            ) : null}
            <time dateTime={new Date(meeting.createdAt).toISOString()} className="shrink-0">
              {formatMeetingListDate(meeting.createdAt)}
            </time>
          </div>
          {ACTIVE_STATUSES.has(meeting.status) && meeting.status !== 'queued' && (
            <div className="mt-2 max-w-sm space-y-1.5" role="status" aria-live="polite">
              <div className="text-muted-foreground flex items-center justify-between gap-3 text-[11px]">
                <span>{progressLabel}</span>
                {progressValue !== null && <span>{progressValue}%</span>}
              </div>
              <div
                className="bg-muted h-1 w-full overflow-hidden rounded-full"
                role="progressbar"
                aria-label={progressLabel}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressValue ?? undefined}
              >
                <div
                  className={cn(
                    'bg-primary h-full rounded-full',
                    progressValue === null
                      ? 'meeting-progress-indeterminate w-1/3'
                      : 'transition-[width] duration-500 ease-out'
                  )}
                  style={progressValue === null ? undefined : { width: `${progressValue}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <MeetingStatusIndicator status={meeting.status} compact />
        {canOpen && (
          <ChevronRightIcon
            aria-hidden="true"
            className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 transition-transform duration-150 ease-out group-hover/meeting:translate-x-0.5 group-focus-visible/meeting:translate-x-0.5"
          />
        )}
      </button>

      {showStopAction && (
        <div className="absolute inset-y-0 right-2 flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="translate-y-0!"
            onClick={(event) => {
              event.stopPropagation()
              onCancel()
            }}
            disabled={isStopping}
            aria-label={isStopping ? 'Stopping transcription' : 'Stop transcription'}
            title={isStopping ? 'Stopping transcription' : 'Stop transcription'}
          >
            {isStopping ? (
              <Spinner aria-hidden="true" className="size-3.5 motion-reduce:animate-none" />
            ) : (
              <SquareIcon aria-hidden="true" className="size-3.5" />
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

const getMeetingProgressValue = (meeting: MeetingListItem): number | null => {
  if (meeting.totalChunks <= 1) {
    return null
  }

  return Math.min(
    100,
    Math.max(0, Math.round((meeting.completedChunks / meeting.totalChunks) * 100))
  )
}

const getMeetingProgressLabel = (
  meeting: MeetingListItem,
  now: number,
  progressValue: number | null
): string => {
  if (progressValue !== null) {
    return `${meeting.completedChunks} of ${meeting.totalChunks} chunks`
  }

  if (meeting.status === 'cancelling') {
    return 'Stopping…'
  }

  return `Working locally · ${formatMeetingElapsed(meeting.updatedAt, now)}`
}

function MeetingStatusIndicator({
  compact = false,
  label,
  status
}: {
  compact?: boolean
  label?: string
  status: MeetingStatus
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap',
        compact ? 'text-[0.68rem] text-muted-foreground' : 'text-xs'
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', statusIndicatorClass[status])}
      />
      <span>{label ?? meetingStatusLabel[status]}</span>
    </span>
  )
}

function MeetingTranscriptDrawer({
  deleteDisabled,
  detailsQuery,
  onAction,
  onCopy,
  onOpenChange,
  onRetry,
  open,
  resumePending,
  selectedMeeting,
  transcriptText
}: {
  deleteDisabled: boolean
  detailsQuery: UseQueryResult<GetMeetingResponse, Error>
  onAction: (action: 'cancel' | 'resume' | 'delete', meetingId: string) => Promise<void>
  onCopy: () => void
  onOpenChange: (open: boolean) => void
  onRetry: () => void
  open: boolean
  resumePending: boolean
  selectedMeeting: MeetingDetails | null
  transcriptText: string
}): React.JSX.Element {
  const isTranscribing = selectedMeeting ? ACTIVE_STATUSES.has(selectedMeeting.status) : false
  const isResumable = selectedMeeting ? ATTENTION_STATUSES.has(selectedMeeting.status) : false

  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="right">
      <DrawerContent className="sm:[--drawer-content-width:42rem]">
        <DrawerHeader className="border-b p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <div
                className="flex flex-wrap items-center gap-2 text-xs"
                role="status"
                aria-live="polite"
              >
                <span className="text-muted-foreground">
                  {selectedMeeting
                    ? formatMeetingListDate(selectedMeeting.createdAt)
                    : 'Transcript'}
                </span>
                {selectedMeeting && (
                  <>
                    <span aria-hidden="true" className="text-border">
                      ·
                    </span>
                    <MeetingStatusIndicator
                      status={selectedMeeting.status}
                      label={isTranscribing ? 'Transcribing locally' : undefined}
                    />
                  </>
                )}
              </div>
              <DrawerTitle className="max-w-[28rem] text-xl font-semibold tracking-tight text-pretty">
                {selectedMeeting ? formatMeetingTitle(selectedMeeting.title) : 'Transcript'}
              </DrawerTitle>
              <DrawerDescription className="truncate">
                {selectedMeeting
                  ? formatMeetingModelLabel(selectedMeeting.modelId)
                  : 'Loading transcript…'}
              </DrawerDescription>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {isResumable && selectedMeeting && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void onAction('resume', selectedMeeting.id)}
                  disabled={resumePending}
                >
                  {resumePending ? (
                    <Spinner aria-hidden="true" />
                  ) : (
                    <RefreshCwIcon aria-hidden="true" />
                  )}
                  {resumePending ? 'Restarting…' : 'Restart'}
                </Button>
              )}
              {selectedMeeting && (
                <MeetingActionsMenu
                  meetingTitle={selectedMeeting.title}
                  disabled={deleteDisabled}
                  onDelete={() => void onAction('delete', selectedMeeting.id)}
                />
              )}
              <DrawerClose
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close transcript"
                  />
                }
              >
                <XIcon aria-hidden="true" />
              </DrawerClose>
            </div>
          </div>
        </DrawerHeader>

        {detailsQuery.isPending ? (
          <MeetingDetailsSkeleton />
        ) : detailsQuery.isError ? (
          <MeetingDetailsErrorState isRetrying={detailsQuery.isRefetching} onRetry={onRetry} />
        ) : selectedMeeting ? (
          <div className="app-scroll-area min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="flex min-h-full flex-col">
              {selectedMeeting.errorMessage && (
                <Alert variant="destructive" className="mb-5">
                  <AlertCircleIcon aria-hidden="true" />
                  <AlertTitle>Transcription needs attention</AlertTitle>
                  <AlertDescription>{selectedMeeting.errorMessage}</AlertDescription>
                </Alert>
              )}

              <div className="flex min-h-0 flex-1 flex-col pt-1">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold tracking-tight">Transcript</h3>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {selectedMeeting.segments.length === 0
                        ? 'No transcript available yet.'
                        : `${selectedMeeting.segments.length} ${
                            selectedMeeting.segments.length === 1 ? 'segment' : 'segments'
                          }`}
                    </p>
                  </div>
                  {transcriptText && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={onCopy}
                      aria-label="Copy transcript"
                      title="Copy transcript"
                    >
                      <CopyIcon aria-hidden="true" />
                    </Button>
                  )}
                </div>

                {selectedMeeting.segments.length === 0 ? (
                  <div className="flex min-h-52 flex-col items-center justify-center p-6 text-center">
                    <AudioLinesIcon
                      aria-hidden="true"
                      className="text-muted-foreground mb-3 size-5"
                    />
                    <p className="text-sm font-medium">
                      {isTranscribing ? 'Transcription is running' : 'No transcript yet'}
                    </p>
                    <p className="text-muted-foreground mt-1 max-w-sm text-xs text-pretty">
                      {isTranscribing
                        ? 'This recording is being processed locally. The transcript will appear here when it is ready.'
                        : 'Restart transcription to try again.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6 pb-4">
                    {selectedMeeting.segments.map((segment) => (
                      <article
                        key={segment.id}
                        className="grid gap-1.5 [content-visibility:auto] sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-3"
                      >
                        <time className="text-muted-foreground pt-0.5 font-mono text-xs tabular-nums">
                          {formatMeetingTimestamp(segment.startMs)}
                        </time>
                        <p className="max-w-[65ch] text-[0.9375rem] leading-7 whitespace-pre-wrap text-pretty">
                          {segment.text}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[20rem] items-center justify-center p-6 text-center">
            <p className="text-muted-foreground text-sm">Transcript unavailable.</p>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}

function MeetingActionsMenu({
  disabled,
  meetingTitle,
  onDelete
}: {
  disabled: boolean
  meetingTitle: string
  onDelete: () => void
}): React.JSX.Element {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const handleDelete = (): void => {
    setIsDeleteDialogOpen(false)
    onDelete()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`More actions for ${meetingTitle}`}
            />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom" className="w-40">
          <DropdownMenuItem
            variant="destructive"
            disabled={disabled}
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2Icon aria-hidden="true" />
            Delete meeting
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              The recording and its local transcript will be permanently removed.
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
    </>
  )
}

function MeetingLibraryEmptyState({
  isImporting,
  onImport
}: {
  isImporting: boolean
  onImport: () => void
}): React.JSX.Element {
  return (
    <Empty className="border-border/70 min-h-[20rem] rounded-2xl border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileAudioIcon aria-hidden="true" />
        </EmptyMedia>
        <h3 className="text-lg font-medium tracking-tight">No meetings yet</h3>
        <EmptyDescription>
          Import a recording to transcribe it locally with the model you choose.
        </EmptyDescription>
      </EmptyHeader>
      <Button type="button" onClick={onImport} disabled={isImporting}>
        {isImporting ? <Spinner aria-hidden="true" /> : <UploadIcon aria-hidden="true" />}
        {isImporting ? 'Importing…' : 'Import recording'}
      </Button>
    </Empty>
  )
}

function FilteredMeetingsEmptyState({
  hasSearch,
  onClear
}: {
  hasSearch: boolean
  onClear: () => void
}): React.JSX.Element {
  return (
    <Empty className="min-h-[16rem] bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchIcon aria-hidden="true" />
        </EmptyMedia>
        <h3 className="text-lg font-medium tracking-tight">No recordings match</h3>
        <EmptyDescription>
          {hasSearch
            ? 'Try a different title or file name, or clear the search to see your full library.'
            : 'There are no recordings in this filter yet.'}
        </EmptyDescription>
      </EmptyHeader>
      <Button type="button" variant="outline" onClick={onClear}>
        Clear filters
      </Button>
    </Empty>
  )
}

function MeetingErrorState({
  isRetrying,
  onRetry
}: {
  isRetrying: boolean
  onRetry: () => void
}): React.JSX.Element {
  return (
    <Alert variant="destructive" className="items-start gap-3 rounded-2xl p-5">
      <AlertCircleIcon aria-hidden="true" className="mt-0.5" />
      <div className="space-y-3">
        <div>
          <AlertTitle>Couldn’t load your recordings</AlertTitle>
          <AlertDescription className="mt-1">
            OpenVocaly could not read the local meeting library. Try again to refresh it.
          </AlertDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? <Spinner aria-hidden="true" /> : <RefreshCwIcon aria-hidden="true" />}
          {isRetrying ? 'Trying again…' : 'Try again'}
        </Button>
      </div>
    </Alert>
  )
}

function MeetingDetailsErrorState({
  isRetrying,
  onRetry
}: {
  isRetrying: boolean
  onRetry: () => void
}): React.JSX.Element {
  return (
    <div className="flex min-h-[20rem] items-center justify-center bg-card p-6">
      <Alert variant="destructive" className="max-w-md">
        <AlertCircleIcon aria-hidden="true" />
        <AlertTitle>Couldn’t load this transcript</AlertTitle>
        <AlertDescription className="space-y-3">
          <span className="block">
            The recording is still in your library. Try again to open its details.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
            {isRetrying ? <Spinner aria-hidden="true" /> : <RefreshCwIcon aria-hidden="true" />}
            {isRetrying ? 'Trying again…' : 'Try again'}
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}

function MeetingsSkeleton(): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="border-b px-3 py-3 sm:px-4">
        <Skeleton className="h-9 w-full max-w-sm rounded-lg" />
      </div>
      <div className="space-y-2 p-3">
        <Skeleton className="mb-3 h-5 w-24 rounded-md" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    </div>
  )
}

function MeetingDetailsSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-[20rem] flex-col gap-5 bg-card p-5">
      <div className="space-y-2 border-b pb-5">
        <Skeleton className="h-3 w-28 rounded-md" />
        <Skeleton className="h-7 w-2/3 rounded-lg" />
        <Skeleton className="h-4 w-1/3 rounded-md" />
      </div>
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-5 w-32 rounded-md" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  )
}
