import type { LocalModelDownloadProgress } from '../../../shared/local-transcription'

const LOCAL_DOWNLOAD_PROGRESS_THROTTLE_MS = 150
const TERMINAL_LOCAL_DOWNLOAD_STATES = new Set<LocalModelDownloadProgress['state']>([
  'complete',
  'error',
  'idle'
])

type LocalDownloadProgressSnapshot = {
  lastTimestamp: number
  lastState: LocalModelDownloadProgress['state'] | null
  lastPercentage: number
}

const shouldEmitLocalDownloadProgress = (
  progress: LocalModelDownloadProgress,
  snapshot: LocalDownloadProgressSnapshot,
  now: number
): boolean => {
  if (TERMINAL_LOCAL_DOWNLOAD_STATES.has(progress.state)) {
    return true
  }

  if (progress.state !== snapshot.lastState) {
    return true
  }

  if (progress.percentage !== snapshot.lastPercentage) {
    return true
  }

  return now - snapshot.lastTimestamp >= LOCAL_DOWNLOAD_PROGRESS_THROTTLE_MS
}

export const createLocalDownloadProgressEmitter = (
  send: (progress: LocalModelDownloadProgress) => void
): ((progress: LocalModelDownloadProgress) => void) => {
  const snapshot: LocalDownloadProgressSnapshot = {
    lastTimestamp: 0,
    lastState: null,
    lastPercentage: -1
  }

  return (progress: LocalModelDownloadProgress): void => {
    const now = Date.now()
    if (!shouldEmitLocalDownloadProgress(progress, snapshot, now)) {
      return
    }

    snapshot.lastTimestamp = now
    snapshot.lastState = progress.state
    snapshot.lastPercentage = progress.percentage
    send(progress)
  }
}
