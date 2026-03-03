import type { RecordingCueKind, RecordingSoundCueSettings } from '../../../shared/recording'
import startCueAssetUrl from '../assets/audio/rec-start.wav'
import cancelCueAssetUrl from '../assets/audio/rec-cancel.wav'
import errorCueAssetUrl from '../assets/audio/rec-error.wav'

const START_CUE_COOLDOWN_MS = 85
const CANCEL_CUE_COOLDOWN_MS = 140
const RETRY_DELAY_MS = 120
const MAX_RETRY_ATTEMPTS = 5
const WARM_OUTPUT_START_DELAY_SEC = 0.06
const COLD_OUTPUT_START_DELAY_SEC = 0.24
const OUTPUT_WARM_TTL_MS = 25_000
const PRIME_DURATION_SEC = 0.05

const CUE_ASSET_URLS: Record<RecordingCueKind, string> = {
  start: startCueAssetUrl,
  cancel: cancelCueAssetUrl,
  error: errorCueAssetUrl
}

const CUE_GAIN_SCALE: Record<RecordingCueKind, number> = {
  start: 1,
  cancel: 0.7,
  error: 1
}

let cueAudioContext: AudioContext | null = null
let lastStartCueAtMs = 0
let lastCancelCueAtMs = 0
let hasWarmOutput = false
let lastOutputPrimeAtMs = 0
let primeBuffer: AudioBuffer | null = null

const cueBuffers: Partial<Record<RecordingCueKind, AudioBuffer>> = {}
const cueBufferLoadPromises: Partial<Record<RecordingCueKind, Promise<void>>> = {}

const wait = (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, delayMs)
  })

const isRunningContext = (context: AudioContext): boolean => context.state === 'running'

const getOrCreateContext = (preferredContext?: AudioContext | null): AudioContext => {
  if (preferredContext && preferredContext.state !== 'closed') {
    return preferredContext
  }

  if (!cueAudioContext || cueAudioContext.state === 'closed') {
    cueAudioContext = new AudioContext({
      latencyHint: 'interactive'
    })
    hasWarmOutput = false
  }

  return cueAudioContext
}

const ensureContextRunning = async (context: AudioContext): Promise<boolean> => {
  if (isRunningContext(context)) {
    return true
  }

  try {
    await context.resume()
  } catch {
    return false
  }

  return isRunningContext(context)
}

const getOrCreatePrimeBuffer = (context: AudioContext): AudioBuffer => {
  if (primeBuffer) {
    return primeBuffer
  }

  const frameCount = Math.max(1, Math.round(context.sampleRate * PRIME_DURATION_SEC))
  primeBuffer = context.createBuffer(1, frameCount, context.sampleRate)

  return primeBuffer
}

const primeOutput = (context: AudioContext): void => {
  const source = context.createBufferSource()
  source.buffer = getOrCreatePrimeBuffer(context)

  const gain = context.createGain()
  gain.gain.setValueAtTime(0.00001, context.currentTime)

  source.connect(gain)
  gain.connect(context.destination)

  const at = context.currentTime + 0.012
  source.start(at)
  source.stop(at + PRIME_DURATION_SEC)

  hasWarmOutput = true
  lastOutputPrimeAtMs = Date.now()
}

const ensureCueBufferReady = async (
  context: AudioContext,
  cue: RecordingCueKind
): Promise<void> => {
  if (cueBuffers[cue]) {
    return
  }

  const inFlightLoad = cueBufferLoadPromises[cue]
  if (inFlightLoad) {
    await inFlightLoad
    return
  }

  const url = CUE_ASSET_URLS[cue]
  const loadPromise = (async () => {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        console.error(`[recording] failed to load ${cue} cue asset`, {
          status: response.status,
          statusText: response.statusText,
          url
        })
        return
      }

      const arrayBuffer = await response.arrayBuffer()
      cueBuffers[cue] = await context.decodeAudioData(arrayBuffer)
    } catch (error) {
      console.error(`[recording] failed to decode ${cue} cue asset`, error)
    }
  })()

  cueBufferLoadPromises[cue] = loadPromise
  try {
    await loadPromise
  } finally {
    delete cueBufferLoadPromises[cue]
  }
}

const playCueBuffer = (context: AudioContext, cue: RecordingCueKind, startAt: number): boolean => {
  const cueBuffer = cueBuffers[cue]
  if (!cueBuffer) {
    console.error(`[recording] cue buffer is unavailable: ${cue}`)
    return false
  }

  const source = context.createBufferSource()
  const gain = context.createGain()
  source.buffer = cueBuffer
  gain.gain.setValueAtTime(CUE_GAIN_SCALE[cue], startAt)
  source.connect(gain)
  gain.connect(context.destination)
  source.start(startAt)

  return true
}

const markCuePlayed = (cue: RecordingCueKind): void => {
  const now = Date.now()
  if (cue === 'start') {
    lastStartCueAtMs = now
  }

  if (cue === 'cancel') {
    lastCancelCueAtMs = now
  }

  lastOutputPrimeAtMs = now
}

const playCueWithContext = async (
  cue: RecordingCueKind,
  context: AudioContext
): Promise<boolean> => {
  const now = Date.now()
  const isLikelyWarm = hasWarmOutput && now - lastOutputPrimeAtMs <= OUTPUT_WARM_TTL_MS

  if (cue === 'start' || !isLikelyWarm) {
    // Re-prime before start to reduce dropped playback after idle/output switches.
    primeOutput(context)
  }

  const at =
    context.currentTime + (isLikelyWarm ? WARM_OUTPUT_START_DELAY_SEC : COLD_OUTPUT_START_DELAY_SEC)

  await ensureCueBufferReady(context, cue)

  const didPlay = playCueBuffer(context, cue, at)
  if (didPlay) {
    markCuePlayed(cue)
  }

  return didPlay
}

export const primeRecordingCueOutput = async (): Promise<void> => {
  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const context = getOrCreateContext()
      const isRunning = await ensureContextRunning(context)

      if (isRunning) {
        primeOutput(context)
        await Promise.all([
          ensureCueBufferReady(context, 'start'),
          ensureCueBufferReady(context, 'cancel')
        ])
        return
      }
    } catch (error) {
      if (attempt >= MAX_RETRY_ATTEMPTS) {
        console.error('[recording] failed to prime cue output', error)
      }
    }

    if (attempt < MAX_RETRY_ATTEMPTS) {
      await wait(RETRY_DELAY_MS)
    }
  }
}

export const playRecordingCue = async (
  cue: RecordingCueKind,
  soundCues: RecordingSoundCueSettings
): Promise<void> => {
  if (!soundCues.enabled) {
    return
  }

  const now = Date.now()
  if (cue === 'start' && now - lastStartCueAtMs < START_CUE_COOLDOWN_MS) {
    return
  }

  if (cue === 'cancel' && now - lastCancelCueAtMs < CANCEL_CUE_COOLDOWN_MS) {
    return
  }

  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const context = getOrCreateContext()
      const isRunning = await ensureContextRunning(context)

      if (isRunning) {
        const didPlay = await playCueWithContext(cue, context)
        if (didPlay) {
          return
        }
      }
    } catch (error) {
      if (attempt >= MAX_RETRY_ATTEMPTS) {
        console.error('[recording] failed to play cue', error)
      }
    }

    if (attempt < MAX_RETRY_ATTEMPTS) {
      await wait(RETRY_DELAY_MS)
    }
  }
}
