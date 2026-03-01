export const clamp01 = (value: number): number => {
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

export const normalizeBands = (input: number[]): number[] =>
  input.map((value) => {
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
  })
