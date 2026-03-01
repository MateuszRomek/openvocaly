import type { RecordingSoundCueSettings } from '../../../shared/recording'

type RecordingCueKind = 'start' | 'cancel'

const START_CUE_COOLDOWN_MS = 85
const CANCEL_CUE_COOLDOWN_MS = 140
const NOTE_GAP_MS = 56
const START_RETRY_DELAY_MS = 130
const CANCEL_RETRY_DELAY_MS = 90
const MAX_RETRY_ATTEMPTS = 10

let cueAudioContext: AudioContext | null = null
let lastStartCueAtMs = 0
let lastCancelCueAtMs = 0
let hasWarmOutput = false

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

const warmOutputOnce = (context: AudioContext): void => {
  if (hasWarmOutput) {
    return
  }

  const at = context.currentTime + 0.012
  const osc = context.createOscillator()
  const gain = context.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(220, at)

  gain.gain.setValueAtTime(0.00001, at)
  gain.gain.linearRampToValueAtTime(0.00002, at + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.00001, at + 0.045)

  osc.connect(gain)
  gain.connect(context.destination)
  osc.start(at)
  osc.stop(at + 0.05)

  hasWarmOutput = true
}

const playChimeNote = (
  context: AudioContext,
  startAt: number,
  startFrequencyHz: number,
  endFrequencyHz: number,
  durationMs: number,
  peakGain: number
): void => {
  const durationSec = durationMs / 1000

  const body = context.createOscillator()
  body.type = 'sine'
  body.frequency.setValueAtTime(startFrequencyHz, startAt)
  body.frequency.exponentialRampToValueAtTime(endFrequencyHz, startAt + durationSec)

  const overtone = context.createOscillator()
  overtone.type = 'triangle'
  overtone.frequency.setValueAtTime(startFrequencyHz * 1.95, startAt)
  overtone.frequency.exponentialRampToValueAtTime(endFrequencyHz * 1.92, startAt + durationSec)

  const bodyGain = context.createGain()
  bodyGain.gain.setValueAtTime(0.0001, startAt)
  bodyGain.gain.linearRampToValueAtTime(peakGain, startAt + 0.016)
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec + 0.042)

  const overtoneGain = context.createGain()
  overtoneGain.gain.setValueAtTime(0.0001, startAt)
  overtoneGain.gain.linearRampToValueAtTime(peakGain * 0.1, startAt + 0.012)
  overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec + 0.02)

  const highpass = context.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.setValueAtTime(110, startAt)

  const lowpass = context.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.setValueAtTime(1900, startAt)
  lowpass.Q.setValueAtTime(0.42, startAt)

  body.connect(bodyGain)
  overtone.connect(overtoneGain)
  bodyGain.connect(highpass)
  overtoneGain.connect(highpass)
  highpass.connect(lowpass)
  lowpass.connect(context.destination)

  body.start(startAt)
  overtone.start(startAt)
  body.stop(startAt + durationSec + 0.05)
  overtone.stop(startAt + durationSec + 0.03)
}

const playSoftCancelCue = (context: AudioContext, startAt: number): void => {
  const durationSec = 0.14
  const stopAt = startAt + durationSec + 0.03

  const oscillator = context.createOscillator()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(520, startAt)
  oscillator.frequency.exponentialRampToValueAtTime(430, startAt + durationSec)

  const gain = context.createGain()
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.linearRampToValueAtTime(0.052, startAt + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt)

  const highpass = context.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.setValueAtTime(110, startAt)

  const lowpass = context.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.setValueAtTime(1300, startAt)
  lowpass.Q.setValueAtTime(0.35, startAt)

  oscillator.connect(gain)
  gain.connect(highpass)
  highpass.connect(lowpass)
  lowpass.connect(context.destination)

  oscillator.start(startAt)
  oscillator.stop(stopAt)
}

const retryDelayMsForCue = (cue: RecordingCueKind): number =>
  cue === 'start' ? START_RETRY_DELAY_MS : CANCEL_RETRY_DELAY_MS

const playCueWithContext = (cue: RecordingCueKind, context: AudioContext): void => {
  const wasWarm = hasWarmOutput
  warmOutputOnce(context)

  // Cold audio output paths can drop the very first scheduled sound on some systems.
  // Delay the first cue slightly longer so device routing stabilizes.
  const at = context.currentTime + (wasWarm ? 0.02 : 0.14)

  if (cue === 'start') {
    // Lower, softer two-note rise.
    playChimeNote(context, at, 420, 435, 84, 0.12)
    playChimeNote(context, at + NOTE_GAP_MS / 1000, 540, 565, 98, 0.135)
    lastStartCueAtMs = Date.now()
    return
  }

  playSoftCancelCue(context, at)
  lastCancelCueAtMs = Date.now()
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
        playCueWithContext(cue, context)
        return
      }
    } catch (error) {
      if (attempt >= MAX_RETRY_ATTEMPTS) {
        console.error('[recording] failed to play cue', error)
        return
      }
    }

    if (attempt < MAX_RETRY_ATTEMPTS) {
      await wait(retryDelayMsForCue(cue))
    }
  }
}
