import type { CaptureRuntimeState } from './runtime-state'

const VISUALIZER_BAND_COUNT = 20

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }

  if (value <= 0) {
    return 0
  }

  if (value >= 1) {
    return 1
  }

  return value
}

const arrangeCenterOut = (values: number[]): number[] => {
  const count = values.length
  const arranged: number[] = new Array(count).fill(0)
  const leftCenter = Math.floor((count - 1) / 2)
  const rightCenter = leftCenter + 1

  let left = leftCenter
  let right = rightCenter

  for (let index = 0; index < count; index += 1) {
    const value = values[index] ?? 0

    if (index === 0) {
      arranged[leftCenter] = value
      continue
    }

    if (index === 1 && rightCenter < count) {
      arranged[rightCenter] = value
      continue
    }

    if (index % 2 === 0) {
      left -= 1
      if (left >= 0) {
        arranged[left] = value
      }
    } else {
      right += 1
      if (right < count) {
        arranged[right] = value
      }
    }
  }

  return arranged
}

const toLogBands = (
  state: CaptureRuntimeState,
  frequencyData: Uint8Array,
  sampleRate: number,
  bandCount: number,
  speechActivity: number
): number[] => {
  if (!frequencyData.length) {
    return Array.from({ length: bandCount }, () => 0)
  }

  if (state.bandPeaks.length !== bandCount) {
    state.bandPeaks = Array.from({ length: bandCount }, () => 1)
  }

  const nyquist = sampleRate / 2
  const minHz = 60
  const maxHz = Math.max(minHz + 1, nyquist)

  const hzToBin = (hz: number): number => {
    const clamped = Math.min(maxHz, Math.max(minHz, hz))
    return Math.min(
      frequencyData.length - 1,
      Math.max(0, Math.floor((clamped / nyquist) * frequencyData.length))
    )
  }

  const bandEdges: number[] = []
  for (let index = 0; index <= bandCount; index += 1) {
    const progress = index / bandCount
    const hz = minHz * Math.pow(maxHz / minHz, progress)
    bandEdges.push(hzToBin(hz))
  }

  const values: number[] = new Array(bandCount).fill(0)

  for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
    const start = bandEdges[bandIndex] ?? 0
    const end = Math.max(start + 1, bandEdges[bandIndex + 1] ?? start + 1)

    let peak = 0
    for (
      let sampleIndex = start;
      sampleIndex < end && sampleIndex < frequencyData.length;
      sampleIndex += 1
    ) {
      const value = frequencyData[sampleIndex] ?? 0
      if (value > peak) {
        peak = value
      }
    }

    const tilt = 0.8 + 0.7 * (bandIndex / Math.max(1, bandCount - 1))
    const tilted = peak * tilt

    const previousPeak = state.bandPeaks[bandIndex] ?? 1
    const decayedPeak = Math.max(1, previousPeak * 0.98)
    const nextPeak = Math.max(decayedPeak, tilted)
    state.bandPeaks[bandIndex] = nextPeak

    const normalized = Math.min(1, tilted / nextPeak)
    const gate = Math.max(0.04, 0.12 - speechActivity * 0.06)
    const gated = Math.max(0, normalized - gate)

    const adaptiveCeiling = 0.82 - Math.max(0, speechActivity - 0.5) * 0.28
    const gain = 0.58 + speechActivity * 0.36
    const shaped = Math.pow(gated, 0.9) * gain

    values[bandIndex] = Math.min(adaptiveCeiling, shaped)
  }

  return values
}

const computeSpeechEnergy = (frequencyData: Uint8Array, sampleRate: number): number => {
  if (!frequencyData.length) {
    return 0
  }

  const nyquist = sampleRate / 2
  const speechMinHz = 180
  const speechMaxHz = 3600

  const toBin = (hz: number): number =>
    Math.min(
      frequencyData.length - 1,
      Math.max(0, Math.floor((hz / nyquist) * frequencyData.length))
    )

  const start = toBin(speechMinHz)
  const end = Math.max(start + 1, toBin(speechMaxHz))

  let sum = 0
  let count = 0

  for (let index = start; index < end && index < frequencyData.length; index += 1) {
    sum += frequencyData[index] ?? 0
    count += 1
  }

  if (!count) {
    return 0
  }

  const average = sum / count
  return Math.pow(average / 255, 0.8)
}

export const startAudioLevels = (
  state: CaptureRuntimeState,
  onMeter: (payload: { sessionId: string; level: number; bands: number[] }) => void
): void => {
  if (!state.analyserNode || !state.sessionId) {
    return
  }

  const timeDomainData = new Uint8Array(state.analyserNode.fftSize)
  const frequencyData = new Uint8Array(state.analyserNode.frequencyBinCount)

  state.meterTimer = window.setInterval(() => {
    if (!state.analyserNode || !state.sessionId) {
      return
    }

    state.analyserNode.getByteTimeDomainData(timeDomainData)
    state.analyserNode.getByteFrequencyData(frequencyData)

    let sumSquares = 0

    for (let index = 0; index < timeDomainData.length; index += 1) {
      const sample = (timeDomainData[index] - 128) / 128
      sumSquares += sample * sample
    }

    const rms = Math.sqrt(sumSquares / timeDomainData.length)
    const speechEnergy = computeSpeechEnergy(frequencyData, state.audioContext?.sampleRate ?? 44100)
    const speechDetected = speechEnergy > state.noiseFloor * 1.22 + 0.008

    const floorBlend = speechDetected ? 0.004 : 0.08
    state.noiseFloor = state.noiseFloor * (1 - floorBlend) + speechEnergy * floorBlend

    const gatedSpeech = clamp01((speechEnergy - (state.noiseFloor + 0.006)) * 7.8)

    if (gatedSpeech > state.speechActivity) {
      state.speechActivity = state.speechActivity * 0.52 + gatedSpeech * 0.48
    } else {
      state.speechActivity = state.speechActivity * 0.84 + gatedSpeech * 0.16
    }

    const rmsLevel = clamp01(rms * 2.2)
    const nextLevel = clamp01(Math.max(rmsLevel * 0.4, state.speechActivity))

    if (nextLevel > state.meterLevel) {
      state.meterLevel = state.meterLevel * 0.5 + nextLevel * 0.5
    } else {
      state.meterLevel = state.meterLevel * 0.88 + nextLevel * 0.12
    }

    const bands = toLogBands(
      state,
      frequencyData,
      state.audioContext?.sampleRate ?? 44100,
      VISUALIZER_BAND_COUNT,
      state.speechActivity
    )

    onMeter({
      sessionId: state.sessionId,
      level: state.meterLevel,
      bands: arrangeCenterOut(bands)
    })
  }, 50)
}
