import type { RecordingCaptureEvent, RecordingFailureReason } from '../../../shared/recording'

type CaptureChunkInput = {
  sessionId: string
  chunk: Uint8Array
}

type CaptureAudioLevelsInput = {
  sessionId: string
  level: number
  bands: number[]
}

type CaptureStartedInput = {
  sessionId: string
}

type CaptureStoppedInput = {
  sessionId: string
  durationMs: number
}

type CaptureFailureInput = {
  sessionId: string | null
  reason: RecordingFailureReason
  message?: string
}

export type CaptureEventDelegates = {
  onChunk: (input: CaptureChunkInput) => Promise<void>
  onStarted: (input: CaptureStartedInput) => Promise<void>
  onAudioLevels: (input: CaptureAudioLevelsInput) => Promise<void>
  onStopped: (input: CaptureStoppedInput) => Promise<void>
  onFailure: (input: CaptureFailureInput) => Promise<void>
}

type RouteCaptureEventInput = {
  event: RecordingCaptureEvent
  activeSessionId: string | null
  delegates: CaptureEventDelegates
}

/**
 * Routes capture runtime events to orchestrator-provided callbacks.
 * Only session-matching chunk/audio-level events are forwarded.
 */
export const routeCaptureEvent = async ({
  event,
  activeSessionId,
  delegates
}: RouteCaptureEventInput): Promise<void> => {
  if (event.type === 'chunk') {
    if (!activeSessionId || activeSessionId !== event.sessionId) {
      return
    }

    await delegates.onChunk({
      sessionId: event.sessionId,
      chunk: event.chunk
    })
    return
  }

  if (event.type === 'meter') {
    if (!activeSessionId || activeSessionId !== event.sessionId) {
      return
    }

    await delegates.onAudioLevels({
      sessionId: event.sessionId,
      level: event.level,
      bands: event.bands
    })
    return
  }

  if (event.type === 'started') {
    await delegates.onStarted({
      sessionId: event.sessionId
    })
    return
  }

  if (event.type === 'stopped') {
    await delegates.onStopped({
      sessionId: event.sessionId,
      durationMs: event.durationMs
    })
    return
  }

  await delegates.onFailure({
    sessionId: event.sessionId,
    reason: event.reason,
    message: event.message
  })
}
