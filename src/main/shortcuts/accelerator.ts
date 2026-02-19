import { VALID_MODIFIERS } from './constants'

/**
 * Normalizes user-provided accelerator strings to a stable `Modifier+Key` format.
 */
export const normalizeAccelerator = (value: string): string =>
  value.trim().replace(/\s*\+\s*/g, '+')

export const toLower = (value: string): string => value.toLowerCase()

/**
 * Validates accelerator syntax before attempting OS registration.
 * This catches malformed values early and keeps error handling deterministic.
 */
export const isValidAccelerator = (value: string): boolean => {
  const tokens = value
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length < 2) {
    return false
  }

  const key = tokens[tokens.length - 1]
  const modifiers = tokens.slice(0, -1)

  if (!key || modifiers.length === 0) {
    return false
  }

  if (modifiers.some((modifier) => !VALID_MODIFIERS.has(modifier))) {
    return false
  }

  if (VALID_MODIFIERS.has(key)) {
    return false
  }

  if (key.includes('+')) {
    return false
  }

  return true
}
