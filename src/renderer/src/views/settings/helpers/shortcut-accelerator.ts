import { SHORTCUT_ERROR_MESSAGES } from '../constants/shortcuts'
import type {
  KeyboardCaptureEvent,
  ShortcutErrorCode,
  ShortcutPlatform
} from '../queries/shortcuts/shortcuts.types'

export const normalizeKey = (key: string): string | null => {
  if (key === ' ' || key === 'Spacebar') {
    return 'Space'
  }

  const keyMap: Record<string, string> = {
    Enter: 'Enter',
    Escape: 'Escape',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right'
  }

  if (keyMap[key]) {
    return keyMap[key]
  }

  if (/^F\d{1,2}$/i.test(key)) {
    return key.toUpperCase()
  }

  if (key.length === 1) {
    return key.toUpperCase()
  }

  return null
}

export const buildAcceleratorFromKeyEvent = (
  event: KeyboardCaptureEvent,
  platform: ShortcutPlatform
): string | null => {
  const key = normalizeKey(event.key)

  if (!key || ['Meta', 'Control', 'Shift', 'Alt'].includes(event.key)) {
    return null
  }

  const modifiers: string[] = []

  if (event.metaKey) {
    modifiers.push(platform === 'darwin' ? 'Command' : 'Super')
  }

  if (event.ctrlKey) {
    modifiers.push('Control')
  }

  if (event.altKey) {
    modifiers.push('Alt')
  }

  if (event.shiftKey) {
    modifiers.push('Shift')
  }

  if (modifiers.length === 0) {
    return key
  }

  return [...modifiers, key].join('+')
}

export const splitAccelerator = (accelerator: string): string[] =>
  accelerator
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)

const SPECIAL_TOKEN_LABELS: Record<string, string> = {
  Enter: 'Enter',
  Escape: 'Esc',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Up: 'Up',
  Down: 'Down',
  Left: 'Left',
  Right: 'Right',
  Space: 'Space'
}

const isToken = (token: string, aliases: readonly string[]): boolean =>
  aliases.some((alias) => alias.toLowerCase() === token.toLowerCase())

const displaySuperKey = (platform: ShortcutPlatform): string => {
  if (platform === 'darwin') {
    return '⌘'
  }

  if (platform === 'win32') {
    return 'Win'
  }

  return 'Super'
}

export const toDisplayToken = (token: string, platform: ShortcutPlatform): string => {
  if (isToken(token, ['CommandOrControl'])) {
    return platform === 'darwin' ? '⌘' : 'Ctrl'
  }

  if (isToken(token, ['Command', 'Cmd', 'Meta', 'Super'])) {
    return displaySuperKey(platform)
  }

  if (isToken(token, ['Control', 'Ctrl'])) {
    return platform === 'darwin' ? '⌃' : 'Ctrl'
  }

  if (isToken(token, ['Alt', 'Option'])) {
    return platform === 'darwin' ? '⌥' : 'Alt'
  }

  if (isToken(token, ['Shift'])) {
    return platform === 'darwin' ? '⇧' : 'Shift'
  }

  if (SPECIAL_TOKEN_LABELS[token]) {
    return SPECIAL_TOKEN_LABELS[token]
  }

  return token.length === 1 ? token.toUpperCase() : token
}

export const toErrorMessage = (errorCode: ShortcutErrorCode | undefined): string | null => {
  if (!errorCode) {
    return null
  }

  return SHORTCUT_ERROR_MESSAGES[errorCode] ?? 'Could not save shortcut. Try again.'
}
