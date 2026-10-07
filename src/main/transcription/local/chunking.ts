export type OverlappingWindow = {
  windowIndex: number
  windowCount: number
  startUnit: number
  endUnit: number
}

const normalizePositiveInteger = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback
  }

  const normalized = Math.floor(value)
  if (normalized <= 0) {
    return fallback
  }

  return normalized
}

export const buildOverlappingWindows = (
  totalUnits: number,
  chunkUnits: number,
  overlapUnits: number
): OverlappingWindow[] => {
  const normalizedTotalUnits = Math.max(0, Math.floor(totalUnits))
  if (normalizedTotalUnits <= 0) {
    return [
      {
        windowIndex: 1,
        windowCount: 1,
        startUnit: 0,
        endUnit: 0
      }
    ]
  }

  const normalizedChunkUnits = normalizePositiveInteger(chunkUnits, normalizedTotalUnits)
  const normalizedOverlapUnits = Math.max(
    0,
    Math.min(normalizedChunkUnits - 1, Math.floor(overlapUnits))
  )
  const strideUnits = normalizedChunkUnits - normalizedOverlapUnits

  const windows: Array<Omit<OverlappingWindow, 'windowCount'>> = []
  let startUnit = 0

  while (startUnit < normalizedTotalUnits) {
    const endUnit = Math.min(normalizedTotalUnits, startUnit + normalizedChunkUnits)
    windows.push({
      windowIndex: windows.length + 1,
      startUnit,
      endUnit
    })

    if (endUnit >= normalizedTotalUnits) {
      break
    }

    const nextStart = startUnit + strideUnits
    if (nextStart <= startUnit) {
      break
    }
    startUnit = nextStart
  }

  const windowCount = windows.length
  return windows.map((window) => ({
    ...window,
    windowCount
  }))
}

export const mergeTranscriptChunkText = (
  currentText: string,
  nextText: string,
  options: { maxOverlapTokens?: number; minOverlapTokens?: number } = {}
): string => {
  const current = currentText.trim()
  const next = nextText.trim()

  if (!current) {
    return next
  }

  if (!next) {
    return current
  }

  const dedupedNext = dedupeChunkBoundary(current, next, options)
  return dedupedNext ? `${current} ${dedupedNext}`.replace(/\s+/g, ' ').trim() : current
}

export const dedupeChunkBoundary = (
  previousText: string,
  nextText: string,
  options: { maxOverlapTokens?: number; minOverlapTokens?: number } = {}
): string => {
  const previousTokens = previousText.trim().split(/\s+/).filter(Boolean)
  const nextTokens = nextText.trim().split(/\s+/).filter(Boolean)

  if (!previousTokens.length || !nextTokens.length) {
    return nextText.trim()
  }

  const maxOverlapTokens = normalizePositiveInteger(options.maxOverlapTokens ?? 16, 16)
  const minOverlapTokens = normalizePositiveInteger(options.minOverlapTokens ?? 2, 2)

  const normalizeToken = (value: string): string =>
    value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

  const maxOverlap = Math.min(maxOverlapTokens, previousTokens.length, nextTokens.length)
  const minOverlap = Math.min(maxOverlap, minOverlapTokens)

  for (let overlap = maxOverlap; overlap >= minOverlap; overlap -= 1) {
    const previousSlice = previousTokens.slice(previousTokens.length - overlap).map(normalizeToken)
    const nextSlice = nextTokens.slice(0, overlap).map(normalizeToken)

    if (
      previousSlice.some((token) => token.length === 0) ||
      nextSlice.some((token) => token.length === 0)
    ) {
      continue
    }

    const isMatch = previousSlice.every((token, index) => token === nextSlice[index])
    if (!isMatch) {
      continue
    }

    return nextTokens.slice(overlap).join(' ').trim()
  }

  return nextText.trim()
}

export type AudioSpan = {
  startMs: number
  endMs: number
}

const ENERGY_FRAME_MS = 20

export const planQuietAudioSpans = (
  samples: Buffer,
  sampleRate: number,
  options: { targetMs: number; searchMs: number; quietWindowMs: number }
): AudioSpan[] => {
  const frameSamples = Math.max(1, Math.round((sampleRate * ENERGY_FRAME_MS) / 1000))
  const frameCount = Math.floor(samples.length / 2 / frameSamples)
  const durationMs = Math.floor((samples.length / 2 / sampleRate) * 1000)
  const quietFrames = Math.max(1, Math.round(options.quietWindowMs / ENERGY_FRAME_MS))
  const targetFrames = Math.round(options.targetMs / ENERGY_FRAME_MS)
  const searchFrames = Math.round(options.searchMs / ENERGY_FRAME_MS)

  const frameEnergy = (frame: number): number => {
    let energy = 0
    const firstSample = frame * frameSamples
    for (let index = firstSample; index < firstSample + frameSamples; index += 1) {
      const sample = samples.readInt16LE(index * 2)
      energy += sample * sample
    }
    return energy
  }

  const spans: AudioSpan[] = []
  let startFrame = 0
  while (frameCount - startFrame > targetFrames + searchFrames + quietFrames) {
    const firstFrame = startFrame + targetFrames - searchFrames
    const lastFrame = startFrame + targetFrames + searchFrames
    const energies = Array.from({ length: lastFrame + quietFrames - firstFrame }, (_, offset) =>
      frameEnergy(firstFrame + offset)
    )
    let windowEnergy = energies.slice(0, quietFrames).reduce((sum, energy) => sum + energy, 0)
    let quietestOffset = 0
    let quietestEnergy = windowEnergy
    for (let offset = 1; offset <= lastFrame - firstFrame; offset += 1) {
      windowEnergy += energies[offset + quietFrames - 1] - energies[offset - 1]
      if (windowEnergy < quietestEnergy) {
        quietestEnergy = windowEnergy
        quietestOffset = offset
      }
    }
    const cutFrame = firstFrame + quietestOffset + Math.floor(quietFrames / 2)
    spans.push({ startMs: startFrame * ENERGY_FRAME_MS, endMs: cutFrame * ENERGY_FRAME_MS })
    startFrame = cutFrame
  }
  spans.push({ startMs: startFrame * ENERGY_FRAME_MS, endMs: durationMs })
  return spans
}
