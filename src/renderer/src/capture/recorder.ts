import type {
  RecordingCaptureCommand,
  RecordingFailureReason,
  RecordingSoundCueSettings
} from '../../../shared/recording'
import { DEFAULT_RECORDING_SOUND_CUE_SETTINGS } from '../../../shared/recording'
import { emitCaptureChunk, emitCaptureError, emitCaptureMeter, emitCaptureStopped } from './ipc'
import { startAudioLevels } from './audio-levels'
import { playRecordingCue } from './audio-cues'
import {
  finalizeCaptureState,
  flushPendingChunkWrites,
  type CaptureRuntimeState
} from './runtime-state'

type StartCommand = Extract<RecordingCaptureCommand, { type: 'start' }>

const resolveSoundCueSettings = (
  input: RecordingSoundCueSettings | undefined
): RecordingSoundCueSettings => ({
  enabled: input?.enabled ?? DEFAULT_RECORDING_SOUND_CUE_SETTINGS.enabled
})

const pickMimeType = (): string | null => {
  const preferredType = 'audio/webm;codecs=opus'

  if (MediaRecorder.isTypeSupported(preferredType)) {
    return preferredType
  }

  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'audio/webm'
  }

  return null
}

export const stopCapture = (state: CaptureRuntimeState): void => {
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
  void playRecordingCue('cancel', resolveSoundCueSettings(soundCues)).catch((error) => {
    console.error('[recording] failed to play cancel cue', error)
  })

  if (!state.mediaRecorder || state.mediaRecorder.state === 'inactive') {
    emitCaptureError(state.sessionId, reason)
    finalizeCaptureState(state)
    return
  }

  state.stopAsFailure = {
    reason,
    message: reason === 'aborted' ? 'Recording was cancelled.' : undefined
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
    return
  }

  const mimeType = pickMimeType()

  if (!mimeType) {
    emitCaptureError(state.sessionId, 'capture_error', 'MediaRecorder does not support WebM audio.')
    return
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    })

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: 96000
    })

    const audioContext = new AudioContext()
    try {
      await audioContext.resume()
    } catch {
      // Ignore resume failures; cue playback handles retry paths.
    }
    const source = audioContext.createMediaStreamSource(stream)
    const analyserNode = audioContext.createAnalyser()
    analyserNode.fftSize = 1024
    analyserNode.smoothingTimeConstant = 0.45
    source.connect(analyserNode)

    state.sessionId = command.sessionId
    state.mediaStream = stream
    state.mediaRecorder = mediaRecorder
    state.audioContext = audioContext
    state.analyserNode = analyserNode
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

        finalizeCaptureState(state)
      })()
    }

    mediaRecorder.start(250)

    void playRecordingCue('start', resolveSoundCueSettings(command.soundCues))

    startAudioLevels(state, ({ sessionId, level, bands }) => {
      emitCaptureMeter(sessionId, level, bands)
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      emitCaptureError(
        state.sessionId,
        'microphone_permission_denied',
        'Microphone permission is denied.'
      )
    } else {
      emitCaptureError(
        state.sessionId,
        'capture_error',
        error instanceof Error ? error.message : 'Failed to start audio capture.'
      )
    }

    finalizeCaptureState(state)
  }
}
