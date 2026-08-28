import { useMemo, useState } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import {
  AlertCircleIcon,
  AudioLinesIcon,
  CheckCircle2Icon,
  Clock3Icon,
  CopyIcon,
  FileAudioIcon,
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
  AlertDialogTitle,
  AlertDialogTrigger
} from '@renderer/ui/alert-dialog'
import { Badge } from '@renderer/ui/badge'
import { Button } from '@renderer/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@renderer/ui/empty'
import { Input } from '@renderer/ui/input'
import { Progress } from '@renderer/ui/progress'
import { Skeleton } from '@renderer/ui/skeleton'
import { Spinner } from '@renderer/ui/spinner'
import { cn } from '@renderer/lib/utils'
import {
  formatMeetingDate,
  formatMeetingDuration,
  formatMeetingListDate,
  formatMeetingTimestamp,
  meetingStatusDescription,
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

const ACTIVE_STATUSES: ReadonlySet<MeetingStatus> = new Set(['queued', 'processing', 'cancelling'])
const READY_STATUSES: ReadonlySet<MeetingStatus> = new Set(['completed'])
const ATTENTION_STATUSES: ReadonlySet<MeetingStatus> = new Set(['partial', 'failed', 'cancelled'])

const EMPTY_MEETINGS: MeetingListItem[] = []

type MeetingFilter = 'all' | 'active' | 'ready' | 'attention'

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
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<MeetingFilter>('all')

  const meetings = meetingsQuery.data?.items ?? EMPTY_MEETINGS
  const searchQuery = search.trim().toLocaleLowerCase()

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

  const statusCounts = useMemo(
    () => ({
      all: meetings.length,
      active: meetings.filter((meeting) => ACTIVE_STATUSES.has(meeting.status)).length,
      ready: meetings.filter((meeting) => READY_STATUSES.has(meeting.status)).length,
      attention: meetings.filter((meeting) => ATTENTION_STATUSES.has(meeting.status)).length
    }),
    [meetings]
  )

  const effectiveSelectedMeetingId = filteredMeetings.some(
    (meeting) => meeting.id === selectedMeetingId
  )
    ? selectedMeetingId
    : (filteredMeetings[0]?.id ?? null)
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
          ? 'Transcription will pause after the current chunk.'
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

  const clearFilters = (): void => {
    setSearch('')
    setFilter('all')
  }

  return (
    <section className="w-full space-y-5 py-1 sm:space-y-6 sm:py-2">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-muted-foreground text-[0.68rem] font-semibold uppercase tracking-[0.18em]">
            Local audio library
          </p>
          <div className="flex items-center gap-2.5">
            <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-xl">
              <AudioLinesIcon aria-hidden="true" className="size-4" />
            </span>
            <h2 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
              Meetings
            </h2>
          </div>
          <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
            Keep recordings close, turn them into transcripts on-device, and return to the exact
            moment you need.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => void handleImport()}
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
      </header>

      <div className="grid overflow-hidden rounded-2xl border bg-card/35 sm:grid-cols-3">
        <LibraryStat
          icon={<FileAudioIcon aria-hidden="true" />}
          label="Recordings"
          value={statusCounts.all}
        />
        <LibraryStat
          className="border-t sm:border-t-0 sm:border-l"
          icon={<Clock3Icon aria-hidden="true" />}
          label="In progress"
          value={statusCounts.active}
        />
        <LibraryStat
          className="border-t sm:border-t-0 sm:border-l"
          icon={<CheckCircle2Icon aria-hidden="true" />}
          label="Ready to read"
          value={statusCounts.ready}
        />
      </div>

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
          onImport={() => void handleImport()}
        />
      ) : (
        <>
          <MeetingToolbar
            filter={filter}
            filterCounts={statusCounts}
            search={search}
            onFilterChange={setFilter}
            onSearchChange={setSearch}
            onClearSearch={() => setSearch('')}
          />

          {filteredMeetings.length === 0 ? (
            <FilteredMeetingsEmptyState hasSearch={searchQuery.length > 0} onClear={clearFilters} />
          ) : (
            <div className="grid min-h-[34rem] gap-5 lg:grid-cols-[minmax(16rem,19rem)_minmax(0,1fr)]">
              <aside
                aria-labelledby="meeting-recordings-heading"
                className="min-w-0 rounded-2xl border bg-card/35 p-3"
              >
                <div className="mb-3 flex items-start justify-between gap-3 px-1">
                  <div className="min-w-0">
                    <h3 id="meeting-recordings-heading" className="text-sm font-semibold">
                      Recordings
                    </h3>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {filteredMeetings.length === meetings.length
                        ? `${meetings.length} ${meetings.length === 1 ? 'recording' : 'recordings'}`
                        : `${filteredMeetings.length} shown of ${meetings.length}`}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    aria-label={`${filteredMeetings.length} recordings shown`}
                  >
                    {filteredMeetings.length}
                  </Badge>
                </div>

                <ul className="space-y-2" aria-label="Meeting recordings">
                  {filteredMeetings.map((meeting) => (
                    <li key={meeting.id} className="[content-visibility:auto]">
                      <MeetingListButton
                        meeting={meeting}
                        selected={meeting.id === effectiveSelectedMeetingId}
                        onSelect={() => setSelectedMeetingId(meeting.id)}
                      />
                    </li>
                  ))}
                </ul>
              </aside>

              <MeetingDetailsPanel
                cancelPending={cancelMutation.isPending}
                copyDisabled={!transcriptText}
                deleteDisabled={
                  selectedMeeting?.status === 'queued' ||
                  selectedMeeting?.status === 'processing' ||
                  selectedMeeting?.status === 'cancelling' ||
                  deleteMutation.isPending
                }
                detailsQuery={detailsQuery}
                onAction={runAction}
                onCopy={() => void copyTranscript()}
                onRetry={() => void detailsQuery.refetch()}
                resumePending={resumeMutation.isPending}
                selectedMeeting={selectedMeeting}
                transcriptText={transcriptText}
              />
            </div>
          )}
        </>
      )}
    </section>
  )
}

function LibraryStat({
  className,
  icon,
  label,
  value
}: {
  className?: string
  icon: React.ReactNode
  label: string
  value: number
}): React.JSX.Element {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3.5', className)}>
      <span className="text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  )
}

function MeetingToolbar({
  filter,
  filterCounts,
  search,
  onFilterChange,
  onSearchChange,
  onClearSearch
}: {
  filter: MeetingFilter
  filterCounts: Record<MeetingFilter, number>
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
    <div className="flex flex-col gap-3 rounded-2xl border bg-card/35 p-3 sm:flex-row sm:items-center sm:justify-between">
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
        <span className="text-muted-foreground shrink-0 text-xs font-medium">Show</span>
        <div className="bg-muted flex shrink-0 rounded-4xl p-0.5">
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={filter === option.value ? 'secondary' : 'ghost'}
              size="xs"
              aria-pressed={filter === option.value}
              onClick={() => onFilterChange(option.value)}
              className="touch-manipulation"
            >
              {option.label}
              <span className="text-muted-foreground tabular-nums">
                {filterCounts[option.value]}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </div>
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
  const isActive = ACTIVE_STATUSES.has(meeting.status)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'group w-full cursor-pointer rounded-xl border p-3 text-left transition-[border-color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none touch-manipulation',
        selected
          ? 'border-primary/35 bg-primary/8 shadow-sm ring-1 ring-primary/15'
          : 'bg-card/60 ring-1 ring-foreground/5 hover:border-foreground/15 hover:bg-muted/55'
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors',
            selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}
        >
          <FileAudioIcon aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-medium">{meeting.title}</p>
            <Badge variant={statusBadgeVariant[meeting.status]}>
              {meetingStatusLabel[meeting.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
            {meeting.sourceFileName}
          </p>
          <div className="text-muted-foreground mt-2 flex items-center justify-between gap-2 text-xs">
            <span className="truncate">{formatMeetingDuration(meeting.durationMs)}</span>
            <time dateTime={new Date(meeting.createdAt).toISOString()} className="shrink-0">
              {formatMeetingListDate(meeting.createdAt)}
            </time>
          </div>
        </div>
      </div>
      {isActive && (
        <div className="mt-3 space-y-1.5">
          <div className="text-muted-foreground flex justify-between gap-2 text-[0.68rem]">
            <span>{meetingStatusDescription[meeting.status]}</span>
            <span className="tabular-nums">{getProgress(meeting)}%</span>
          </div>
          <Progress value={getProgress(meeting)} aria-label={`${getProgress(meeting)}% complete`} />
        </div>
      )}
    </button>
  )
}

function MeetingDetailsPanel({
  cancelPending,
  copyDisabled,
  deleteDisabled,
  detailsQuery,
  onAction,
  onCopy,
  onRetry,
  resumePending,
  selectedMeeting,
  transcriptText
}: {
  cancelPending: boolean
  copyDisabled: boolean
  deleteDisabled: boolean
  detailsQuery: UseQueryResult<GetMeetingResponse, Error>
  onAction: (action: 'cancel' | 'resume' | 'delete', meetingId: string) => Promise<void>
  onCopy: () => void
  onRetry: () => void
  resumePending: boolean
  selectedMeeting: MeetingDetails | null
  transcriptText: string
}): React.JSX.Element {
  if (detailsQuery.isPending) {
    return <MeetingDetailsSkeleton />
  }

  if (detailsQuery.isError) {
    return <MeetingDetailsErrorState isRetrying={detailsQuery.isRefetching} onRetry={onRetry} />
  }

  if (!selectedMeeting) {
    return (
      <div className="flex min-h-[34rem] flex-col items-center justify-center rounded-2xl border bg-card/35 p-6 text-center">
        <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-muted">
          <FileAudioIcon aria-hidden="true" className="text-muted-foreground size-5" />
        </span>
        <h3 className="text-base font-semibold">Select a recording</h3>
        <p className="text-muted-foreground mt-1 max-w-xs text-sm text-pretty">
          Choose a recording from the library to open its local transcript.
        </p>
      </div>
    )
  }

  const isTranscribing =
    selectedMeeting.status === 'queued' ||
    selectedMeeting.status === 'processing' ||
    selectedMeeting.status === 'cancelling'
  const isResumable =
    selectedMeeting.status === 'failed' ||
    selectedMeeting.status === 'partial' ||
    selectedMeeting.status === 'cancelled'

  return (
    <section
      aria-labelledby="meeting-detail-heading"
      className="flex min-h-[34rem] min-w-0 flex-col overflow-hidden rounded-2xl border bg-card/65 ring-1 ring-foreground/5"
    >
      <header className="space-y-4 border-b p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em]">
              <span>Selected recording</span>
              <span aria-hidden="true">·</span>
              <time dateTime={new Date(selectedMeeting.createdAt).toISOString()}>
                {formatMeetingListDate(selectedMeeting.createdAt)}
              </time>
            </div>
            <h3
              id="meeting-detail-heading"
              className="max-w-2xl text-lg font-semibold text-pretty sm:text-xl"
            >
              {selectedMeeting.title}
            </h3>
            <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
              <FileAudioIcon aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate" title={selectedMeeting.sourceFileName}>
                {selectedMeeting.sourceFileName}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            {isTranscribing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onAction('cancel', selectedMeeting.id)}
                disabled={cancelPending}
              >
                {cancelPending ? <Spinner aria-hidden="true" /> : <SquareIcon aria-hidden="true" />}
                {cancelPending ? 'Pausing…' : 'Pause'}
              </Button>
            )}
            {isResumable && (
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
                {resumePending ? 'Resuming…' : 'Resume'}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCopy}
              disabled={copyDisabled}
            >
              <CopyIcon aria-hidden="true" />
              Copy transcript
            </Button>
            <DeleteMeetingButton
              disabled={deleteDisabled}
              onDelete={() => void onAction('delete', selectedMeeting.id)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusBadgeVariant[selectedMeeting.status]} size="md">
            {meetingStatusLabel[selectedMeeting.status]}
          </Badge>
          <p className="text-muted-foreground text-sm">
            {meetingStatusDescription[selectedMeeting.status]}
          </p>
        </div>

        {isTranscribing && (
          <div
            className="space-y-2 rounded-xl border border-warning/25 bg-warning/6 p-3"
            role="status"
            aria-live="polite"
          >
            <div className="text-muted-foreground flex justify-between gap-2 text-xs">
              <span>
                {selectedMeeting.totalChunks === 0
                  ? 'Preparing audio chunks…'
                  : `Chunk ${Math.min(
                      selectedMeeting.completedChunks + 1,
                      selectedMeeting.totalChunks
                    )} of ${selectedMeeting.totalChunks}`}
              </span>
              <span className="font-medium tabular-nums">{getProgress(selectedMeeting)}%</span>
            </div>
            <Progress
              value={getProgress(selectedMeeting)}
              aria-label={`Transcription ${getProgress(selectedMeeting)}% complete`}
            />
          </div>
        )}

        {selectedMeeting.errorMessage && (
          <Alert variant="destructive">
            <AlertCircleIcon aria-hidden="true" />
            <AlertTitle>Transcription needs attention</AlertTitle>
            <AlertDescription>{selectedMeeting.errorMessage}</AlertDescription>
          </Alert>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-5 p-4 sm:p-5">
        <div className="rounded-xl border bg-muted/20 p-3.5">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <AudioLinesIcon aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-[0.68rem] font-semibold uppercase tracking-[0.14em]">
                Source audio
              </p>
              <p
                className="mt-0.5 truncate text-sm font-medium"
                title={selectedMeeting.sourceFileName}
              >
                {selectedMeeting.sourceFileName}
              </p>
            </div>
            <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
              Stored locally
            </Badge>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3">
            <MeetingMeta label="Length" value={formatMeetingDuration(selectedMeeting.durationMs)} />
            <MeetingMeta label="Model" value={selectedMeeting.modelId} translateValue />
            <MeetingMeta label="Sections" value={String(selectedMeeting.segments.length)} />
          </dl>
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold">Transcript</h4>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {selectedMeeting.segments.length === 0
                  ? 'The transcript will appear here as local processing finishes.'
                  : `${selectedMeeting.segments.length} timestamped ${
                      selectedMeeting.segments.length === 1 ? 'section' : 'sections'
                    }`}
              </p>
            </div>
            {transcriptText && (
              <Badge variant="outline" className="shrink-0">
                Ready to read
              </Badge>
            )}
          </div>

          {selectedMeeting.segments.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/15 p-6 text-center">
              <span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-muted">
                <AudioLinesIcon aria-hidden="true" className="text-muted-foreground size-4" />
              </span>
              <p className="text-sm font-medium">
                {isTranscribing ? 'Listening for the first section…' : 'No transcript sections yet'}
              </p>
              <p className="text-muted-foreground mt-1 max-w-sm text-xs text-pretty">
                {isTranscribing
                  ? 'OpenVocaly is processing this audio locally. New sections will appear automatically.'
                  : 'Resume transcription to continue building the local transcript.'}
              </p>
            </div>
          ) : (
            <div className="app-scroll-area max-h-[32rem] min-h-[14rem] overflow-y-auto overscroll-contain rounded-xl border bg-background/35 p-4 sm:p-5">
              <div className="space-y-5">
                {selectedMeeting.segments.map((segment) => (
                  <article
                    key={segment.id}
                    className="grid gap-2 border-l-2 border-primary/25 pl-3 [content-visibility:auto] sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:border-l-0 sm:pl-0"
                  >
                    <time className="text-primary pt-0.5 font-mono text-xs font-semibold tabular-nums">
                      {formatMeetingTimestamp(segment.startMs)}
                    </time>
                    <p className="text-sm leading-7 whitespace-pre-wrap text-pretty">
                      {segment.text}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="text-muted-foreground border-t px-4 py-3 text-xs sm:px-5">
        Imported {formatMeetingDate(selectedMeeting.createdAt)} · Stored and processed locally
      </footer>
    </section>
  )
}

function MeetingMeta({
  label,
  translateValue = false,
  value
}: {
  label: string
  translateValue?: boolean
  value: string
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-[0.68rem]">{label}</dt>
      <dd
        className="mt-0.5 truncate text-xs font-medium"
        translate={translateValue ? 'no' : undefined}
        title={value}
      >
        {value}
      </dd>
    </div>
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
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label="Delete meeting"
          >
            <Trash2Icon aria-hidden="true" />
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

function MeetingLibraryEmptyState({
  isImporting,
  onImport
}: {
  isImporting: boolean
  onImport: () => void
}): React.JSX.Element {
  return (
    <Empty className="bg-card/35 min-h-[28rem] border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileAudioIcon aria-hidden="true" />
        </EmptyMedia>
        <h3 className="text-lg font-medium tracking-tight">Your audio library is ready</h3>
        <EmptyDescription>
          Import an MP3, M4A, WAV, WebM, or video file. OpenVocaly will process it in manageable
          chunks using your selected local model.
        </EmptyDescription>
      </EmptyHeader>
      <Button type="button" onClick={onImport} disabled={isImporting}>
        {isImporting ? <Spinner aria-hidden="true" /> : <UploadIcon aria-hidden="true" />}
        {isImporting ? 'Importing…' : 'Choose a recording'}
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
    <Empty className="bg-card/35 min-h-[22rem] border-dashed">
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
    <div className="flex min-h-[34rem] items-center justify-center rounded-2xl border bg-card/35 p-6">
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
    <div className="grid gap-5 lg:grid-cols-[minmax(16rem,19rem)_minmax(0,1fr)]">
      <div className="space-y-2 rounded-2xl border bg-card/35 p-3">
        <Skeleton className="mb-3 h-8 rounded-lg" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <MeetingDetailsSkeleton />
    </div>
  )
}

function MeetingDetailsSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-[34rem] flex-col gap-5 rounded-2xl border bg-card/50 p-5">
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
