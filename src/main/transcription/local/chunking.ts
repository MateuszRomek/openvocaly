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
