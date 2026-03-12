const WORD_TOKEN_PATTERN = /\S+/g

export const countWords = (text: string): number => {
  if (!text.trim()) {
    return 0
  }

  const matches = text.match(WORD_TOKEN_PATTERN)
  return matches ? matches.length : 0
}

export const computeWordsPerMinute = (
  wordCount: number,
  durationMs: number | null | undefined
): number | null => {
  if (!durationMs || durationMs <= 0 || wordCount <= 0) {
    return null
  }

  const minutes = durationMs / 60_000
  if (minutes <= 0) {
    return null
  }

  return wordCount / minutes
}
