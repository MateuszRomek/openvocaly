import type { RecordingFailureReason } from '../../../shared/recording'

export type CaptureRuntimeState = {
  sessionId: string | null
  mediaRecorder: MediaRecorder | null
  mediaStream: MediaStream | null
  audioContext: AudioContext | null
  analyserNode: AnalyserNode | null
  meterTimer: number | null
  meterLevel: number
  noiseFloor: number
  speechActivity: number
  bandPeaks: number[]
  startedAt: number
  stopAsFailure: { reason: RecordingFailureReason; message?: string } | null
  pendingChunkWrites: Set<Promise<void>>
}

export const createCaptureRuntimeState = (): CaptureRuntimeState => ({
  sessionId: null,
  mediaRecorder: null,
  mediaStream: null,
  audioContext: null,
  analyserNode: null,
  meterTimer: null,
  meterLevel: 0,
  noiseFloor: 0.015,
  speechActivity: 0,
  bandPeaks: [],
  startedAt: 0,
  stopAsFailure: null,
  pendingChunkWrites: new Set()
})

const teardownAudioGraph = (state: CaptureRuntimeState): void => {
  if (state.meterTimer !== null) {
    window.clearInterval(state.meterTimer)
    state.meterTimer = null
  }

  if (state.audioContext) {
    void state.audioContext.close()
    state.audioContext = null
  }

  state.analyserNode = null
}

const stopMediaTracks = (state: CaptureRuntimeState): void => {
  if (!state.mediaStream) {
    return
  }

  for (const track of state.mediaStream.getTracks()) {
    track.stop()
  }

  state.mediaStream = null
}

export const finalizeCaptureState = (state: CaptureRuntimeState): void => {
  teardownAudioGraph(state)
  stopMediaTracks(state)
  state.mediaRecorder = null
  state.sessionId = null
  state.startedAt = 0
  state.meterLevel = 0
  state.noiseFloor = 0.015
  state.speechActivity = 0
  state.bandPeaks = []
  state.stopAsFailure = null
  state.pendingChunkWrites.clear()
}

export const flushPendingChunkWrites = async (state: CaptureRuntimeState): Promise<void> => {
  if (!state.pendingChunkWrites.size) {
    return
  }

  await Promise.allSettled([...state.pendingChunkWrites])
}
