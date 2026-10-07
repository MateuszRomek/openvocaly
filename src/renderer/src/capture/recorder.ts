import type {
  RecordingCaptureCommand,
  RecordingFailureReason,
  RecordingSoundCueSettings
} from '../../../shared/recording'
import {
  emitCaptureChunk,
  emitCaptureDeviceResolved,
  emitCaptureError,
  emitCaptureMeter,
  emitCaptureStarted,
  emitCaptureStopped
} from './ipc'
import { resolvePreferredMicrophoneDevice } from './microphone-devices'
import { startAudioLevels } from './audio-levels'
import { playRecordingCue } from './audio-cues'
import {
  resolveCaptureSoundCueSettings,
  resolveSupportedCaptureMimeType,
  toCanceledRecordingMessage,
  toCaptureStartFailure
} from './recorder-helpers'
import {
  finalizeCaptureState,
  flushPendingChunkWrites,
  stopStreamTracks,
  takeLiveWarmStreamForDevice,
  type CaptureRuntimeState
} from './runtime-state'

type StartCommand = Extract<RecordingCaptureCommand, { type: 'start' }>

const START_SIGNAL_DELAY_AFTER_CAPTURE_START_MS = 90
const START_SIGNAL_FALLBACK_DELAY_MS = 1200

const toAudioConstraints = (deviceId: string | null): MediaTrackConstraints => ({
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  ...(deviceId ? { deviceId: { exact: deviceId } } : {})
})

const isMissingDeviceError = (error: unknown): boolean => {
  const name = (error as { name?: unknown } | null)?.name
  return name === 'OverconstrainedError' || name === 'NotFoundError'
}

const openMicrophoneStream = async (
  state: CaptureRuntimeState,
  preferredDeviceId: string | null
): Promise<{ stream: MediaStream; deviceId: string | null }> => {
  const warmStream = takeLiveWarmStreamForDevice(state, preferredDeviceId)
  if (warmStream) {
    return warmStream
  }

  if (preferredDeviceId) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: toAudioConstraints(preferredDeviceId)
      })
      return { stream, deviceId: preferredDeviceId }
    } catch (error) {
      if (!isMissingDeviceError(error)) {
        throw error
      }
    }
  }

  const deviceResolution = await resolvePreferredMicrophoneDevice(preferredDeviceId)
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: toAudioConstraints(deviceResolution.resolvedDeviceId)
  })
  return { stream, deviceId: deviceResolution.resolvedDeviceId }
}

const discardActiveRecorder = (state: CaptureRuntimeState): void => {
  const recorder = state.mediaRecorder
  if (recorder) {
    recorder.ondataavailable = null
    recorder.onstart = null
    recorder.onstop = null
    recorder.onerror = null
    if (recorder.state !== 'inactive') {
      recorder.stop()
    }
  }

  finalizeCaptureState(state)
}

export const stopCapture = (state: CaptureRuntimeState): void => {
  if (state.startReadyTimer !== null) {
    window.clearTimeout(state.startReadyTimer)
    state.startReadyTimer = null
  }

  if (!state.mediaRecorder || state.mediaRecorder.state === 'inactive') {
    return
  }

  state.mediaRecorder.stop()
}

export const cancelCapture = (
  state: CaptureRuntimeState,
  reason: RecordingFailureReason,
  soundCues?: RecordingSoundCueSettings
): void => {
  if (state.startReadyTimer !== null) {
    window.clearTimeout(state.startReadyTimer)
    state.startReadyTimer = null
  }

  void playRecordingCue('cancel', resolveCaptureSoundCueSettings(soundCues)).catch((error) => {
    console.error('[recording] failed to play cancel cue', error)
  })

  if (!state.mediaRecorder || state.mediaRecorder.state === 'inactive') {
    emitCaptureError(state.sessionId, reason)
    finalizeCaptureState(state)
    return
  }

  state.stopAsFailure = {
    reason,
    message: toCanceledRecordingMessage(reason)
  }

  stopCapture(state)
}

/**
 * Starts capture runtime state and wires MediaRecorder/analyser events.
 *
 * On `onstop`, pending chunk serialization is flushed before emitting `stopped`/`error`
 * so the main process never finalizes before the last chunk dispatch settles.
 * For user-initiated cancel (`aborted`), flush is skipped to reduce perceived cancel latency.
 */
export const startCapture = async (
  state: CaptureRuntimeState,
  command: StartCommand
): Promise<void> => {
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    console.warn('[recording] discarding orphaned recorder before new start', {
      orphanSessionId: state.sessionId,
      sessionId: command.sessionId
    })
    discardActiveRecorder(state)
  }

  const mimeType = resolveSupportedCaptureMimeType()

  if (!mimeType) {
    emitCaptureError(
      command.sessionId,
      'capture_error',
      'MediaRecorder does not support WebM audio.'
    )
    return
  }

  const startToken = {}
  state.pendingStartToken = startToken
  state.sessionId = command.sessionId
  const isSuperseded = (): boolean => state.pendingStartToken !== startToken

  let openedStream: MediaStream | null = null
  let committed = false

  try {
    const microphone = await openMicrophoneStream(state, command.preferredMicrophoneDeviceId)
    openedStream = microphone.stream

    if (isSuperseded()) {
      stopStreamTracks(microphone.stream)
      return
    }

    state.pendingStartToken = null
    committed = true
    emitCaptureDeviceResolved(command.sessionId, microphone.deviceId)

    const stream = microphone.stream
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: 96000
    })

    state.mediaStream = stream
    state.mediaStreamDeviceId = microphone.deviceId
    state.mediaRecorder = mediaRecorder
    state.startedAt = Date.now()
    state.stopAsFailure = null
    state.meterLevel = 0

    mediaRecorder.ondataavailable = (event) => {
      const chunkSessionId = state.sessionId
      if (!event.data.size || !chunkSessionId) {
        return
      }

      const chunkWrite = event.data
        .arrayBuffer()
        .then((arrayBuffer) => {
          emitCaptureChunk(chunkSessionId, new Uint8Array(arrayBuffer))
        })
        .catch(() => {
          if (!state.stopAsFailure) {
            state.stopAsFailure = {
              reason: 'capture_error',
              message: 'Failed to serialize captured audio chunk.'
            }
          }
        })
        .finally(() => {
          state.pendingChunkWrites.delete(chunkWrite)
        })

      state.pendingChunkWrites.add(chunkWrite)
    }

    mediaRecorder.onerror = () => {
      state.stopAsFailure = {
        reason: 'capture_error',
        message: 'MediaRecorder emitted an unexpected runtime error.'
      }
    }

    const startCueSettings = resolveCaptureSoundCueSettings(command.soundCues)
    let didSignalStarted = false

    const signalStartedAndPlayCue = (): void => {
      if (didSignalStarted) {
        return
      }

      if (
        state.sessionId !== command.sessionId ||
        !state.mediaRecorder ||
        state.mediaRecorder.state === 'inactive'
      ) {
        return
      }

      didSignalStarted = true
      emitCaptureStarted(command.sessionId)
      void playRecordingCue('start', startCueSettings).catch((error) => {
        console.error('[recording] failed to play start cue', error)
      })
    }

    const scheduleStartSignal = (delayMs: number): void => {
      if (state.startReadyTimer !== null) {
        window.clearTimeout(state.startReadyTimer)
        state.startReadyTimer = null
      }

      state.startReadyTimer = window.setTimeout(() => {
        state.startReadyTimer = null
        signalStartedAndPlayCue()
      }, delayMs)
    }

    mediaRecorder.onstart = () => {
      // Trigger start-ready from actual recorder start to avoid race with slow device/profile init.
      scheduleStartSignal(START_SIGNAL_DELAY_AFTER_CAPTURE_START_MS)
    }

    mediaRecorder.onstop = () => {
      void (async () => {
        const stopFailure = state.stopAsFailure
        const stoppedSessionId = state.sessionId
        const shouldFlushChunks = stopFailure?.reason !== 'aborted'

        if (shouldFlushChunks) {
          await flushPendingChunkWrites(state)
        }

        const durationMs = Math.max(Date.now() - state.startedAt, 0)
        if (stopFailure) {
          emitCaptureError(stoppedSessionId, stopFailure.reason, stopFailure.message)
        } else {
          emitCaptureStopped(stoppedSessionId, durationMs)
        }

        finalizeCaptureState(state, { keepMicWarm: !stopFailure })
      })()
    }

    mediaRecorder.start(250)
    // Fallback if `onstart` is delayed or not emitted by platform-specific backend.
    scheduleStartSignal(START_SIGNAL_FALLBACK_DELAY_MS)

    const audioContext = new AudioContext()
    void audioContext.resume().catch(() => undefined)
    const source = audioContext.createMediaStreamSource(stream)
    const analyserNode = audioContext.createAnalyser()
    analyserNode.fftSize = 1024
    analyserNode.smoothingTimeConstant = 0.45
    source.connect(analyserNode)
    state.audioContext = audioContext
    state.analyserNode = analyserNode

    startAudioLevels(state, ({ sessionId, level, bands }) => {
      emitCaptureMeter(sessionId, level, bands)
    })
  } catch (error) {
    if (!committed && isSuperseded()) {
      if (openedStream) {
        stopStreamTracks(openedStream)
      }
      return
    }

    const failure = toCaptureStartFailure(error)
    emitCaptureError(command.sessionId, failure.reason, failure.message)

    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      discardActiveRecorder(state)
      return
    }

    if (openedStream && state.mediaStream !== openedStream) {
      stopStreamTracks(openedStream)
    }
    finalizeCaptureState(state)
  }
}
