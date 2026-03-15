const WORD_TOKEN_PATTERN = /\S+/g

export const countWords = (text: string): number => {
  if (!text.trim()) {
    return 0
  }

  const matches = text.match(WORD_TOKEN_PATTERN)
  return matches ? matches.length : 0
}
