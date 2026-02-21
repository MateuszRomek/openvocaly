import { VALID_MODIFIERS } from './constants'

export type ShortcutModifierState = {
  cmd: boolean
  ctrl: boolean
  alt: boolean
  shift: boolean
}

export type CanonicalShortcut = {
  key: string
  modifiers: ShortcutModifierState
}

export type PersistedShortcutBinding = CanonicalShortcut & {
  accelerator: string
}

/**
 * Normalizes user-provided accelerator strings to a stable `Modifier+Key` format.
 */
export const normalizeAccelerator = (value: string): string =>
  value.trim().replace(/\s*\+\s*/g, '+')

export const toLower = (value: string): string => value.toLowerCase()

const normalizeKeyToken = (token: string): string => {
  if (token.length === 1) {
    return token.toUpperCase()
  }

  return token
}

const isAlias = (token: string, aliases: readonly string[]): boolean =>
  aliases.some((alias) => alias.toLowerCase() === token.toLowerCase())

const toModifiers = (tokens: string[]): ShortcutModifierState | null => {
  const modifiers: ShortcutModifierState = {
    cmd: false,
    ctrl: false,
    alt: false,
    shift: false
  }

  for (const token of tokens) {
    if (!VALID_MODIFIERS.has(token)) {
      return null
    }

    if (isAlias(token, ['Command', 'Cmd', 'Meta', 'Super'])) {
      modifiers.cmd = true
      continue
    }

    if (isAlias(token, ['Control', 'Ctrl'])) {
      modifiers.ctrl = true
      continue
    }

    if (isAlias(token, ['Alt', 'Option'])) {
      modifiers.alt = true
      continue
    }

    if (isAlias(token, ['Shift'])) {
      modifiers.shift = true
      continue
    }

    if (isAlias(token, ['CommandOrControl'])) {
      if (process.platform === 'darwin') {
        modifiers.cmd = true
      } else {
        modifiers.ctrl = true
      }
      continue
    }
  }

  if (!modifiers.cmd && !modifiers.ctrl && !modifiers.alt && !modifiers.shift) {
    return null
  }

  return modifiers
}

export const parseAccelerator = (value: string): CanonicalShortcut | null => {
  const normalized = normalizeAccelerator(value)
  const tokens = normalized
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length < 2) {
    return null
  }

  const key = normalizeKeyToken(tokens[tokens.length - 1])
  const modifiers = toModifiers(tokens.slice(0, -1))

  if (!key || !modifiers) {
    return null
  }

  return {
    key,
    modifiers
  }
}

export const formatCanonicalShortcut = (binding: CanonicalShortcut): string => {
  const modifiers: string[] = []

  if (binding.modifiers.cmd && binding.modifiers.ctrl) {
    modifiers.push('Command+Control')
  } else if (binding.modifiers.cmd) {
    modifiers.push('Command')
  } else if (binding.modifiers.ctrl) {
    modifiers.push('Control')
  }

  if (binding.modifiers.alt) {
    modifiers.push('Alt')
  }

  if (binding.modifiers.shift) {
    modifiers.push('Shift')
  }

  return [...modifiers, binding.key].join('+')
}

export const toPersistedShortcutBinding = (
  binding: CanonicalShortcut
): PersistedShortcutBinding => ({
  ...binding,
  accelerator: formatCanonicalShortcut(binding)
})

export const areCanonicalShortcutsEqual = (
  left: CanonicalShortcut,
  right: CanonicalShortcut
): boolean =>
  left.key.toLowerCase() === right.key.toLowerCase() &&
  left.modifiers.cmd === right.modifiers.cmd &&
  left.modifiers.ctrl === right.modifiers.ctrl &&
  left.modifiers.alt === right.modifiers.alt &&
  left.modifiers.shift === right.modifiers.shift

/**
 * Validates accelerator syntax before attempting OS registration.
 * This catches malformed values early and keeps error handling deterministic.
 */
export const isValidAccelerator = (value: string): boolean => parseAccelerator(value) !== null
