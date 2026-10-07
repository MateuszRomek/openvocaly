import type { RecordingFailureReason } from '../../../shared/recording'

export const MIC_WARM_GRACE_MS = 15_000

type WarmMicrophoneStream = {
  stream: MediaStream
  deviceId: string | null
  releaseTimer: number
}

export type CaptureRuntimeState = {
  sessionId: string | null
  mediaRecorder: MediaRecorder | null
  mediaStream: MediaStream | null
  mediaStreamDeviceId: string | null
  warmStream: WarmMicrophoneStream | null
  pendingStartToken: object | null
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
  startReadyTimer: number | null
}

export const createCaptureRuntimeState = (): CaptureRuntimeState => ({
  sessionId: null,
  mediaRecorder: null,
  mediaStream: null,
  mediaStreamDeviceId: null,
  warmStream: null,
  pendingStartToken: null,
  audioContext: null,
  analyserNode: null,
  meterTimer: null,
  meterLevel: 0,
  noiseFloor: 0.015,
  speechActivity: 0,
  bandPeaks: [],
  startedAt: 0,
  stopAsFailure: null,
  pendingChunkWrites: new Set(),
  startReadyTimer: null
})

const teardownAudioGraph = (state: CaptureRuntimeState): void => {
  if (state.startReadyTimer !== null) {
    window.clearTimeout(state.startReadyTimer)
    state.startReadyTimer = null
  }

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

export const stopStreamTracks = (stream: MediaStream): void => {
  for (const track of stream.getTracks()) {
    track.stop()
  }
}

const hasLiveAudioTrack = (stream: MediaStream): boolean =>
  stream.getAudioTracks().some((track) => track.readyState === 'live')

export const releaseWarmStream = (state: CaptureRuntimeState): void => {
  const warmStream = state.warmStream
  if (!warmStream) {
    return
  }

  state.warmStream = null
  window.clearTimeout(warmStream.releaseTimer)
  stopStreamTracks(warmStream.stream)
}

export const takeLiveWarmStreamForDevice = (
  state: CaptureRuntimeState,
  preferredDeviceId: string | null
): { stream: MediaStream; deviceId: string | null } | null => {
  const warmStream = state.warmStream
  if (!warmStream) {
    return null
  }

  const matchesDevice = !preferredDeviceId || warmStream.deviceId === preferredDeviceId
  if (!matchesDevice || !hasLiveAudioTrack(warmStream.stream)) {
    releaseWarmStream(state)
    return null
  }

  state.warmStream = null
  window.clearTimeout(warmStream.releaseTimer)
  return { stream: warmStream.stream, deviceId: warmStream.deviceId }
}

const releaseOrParkMediaStream = (state: CaptureRuntimeState, keepMicWarm: boolean): void => {
  const stream = state.mediaStream
  const deviceId = state.mediaStreamDeviceId
  state.mediaStream = null
  state.mediaStreamDeviceId = null

  if (!stream) {
    return
  }

  releaseWarmStream(state)

  if (!keepMicWarm || !hasLiveAudioTrack(stream)) {
    stopStreamTracks(stream)
    return
  }

  const releaseTimer = window.setTimeout(() => {
    if (state.warmStream?.stream === stream) {
      releaseWarmStream(state)
    }
  }, MIC_WARM_GRACE_MS)
  state.warmStream = { stream, deviceId, releaseTimer }
}

export const finalizeCaptureState = (
  state: CaptureRuntimeState,
  options: { keepMicWarm?: boolean } = {}
): void => {
  teardownAudioGraph(state)
  releaseOrParkMediaStream(state, options.keepMicWarm ?? false)
  state.pendingStartToken = null
  state.mediaRecorder = null
  state.sessionId = null
  state.startedAt = 0
  state.meterLevel = 0
  state.noiseFloor = 0.015
  state.speechActivity = 0
  state.bandPeaks = []
  state.stopAsFailure = null
  state.pendingChunkWrites.clear()
  state.startReadyTimer = null
}

export const flushPendingChunkWrites = async (state: CaptureRuntimeState): Promise<void> => {
  if (!state.pendingChunkWrites.size) {
    return
  }

  await Promise.allSettled([...state.pendingChunkWrites])
}
