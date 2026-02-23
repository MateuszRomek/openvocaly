import type { CanonicalShortcut, ShortcutModifierState } from './accelerator'

export type MacModifierState = ShortcutModifierState

export type NativePttEvent = {
  type: 'push_to_talk_start' | 'push_to_talk_stop'
}

export type MacPttBinding = {
  keyCode: number
  modifiers: MacModifierState
}

const MAC_KEY_CODES: Record<string, number> = {
  A: 0,
  S: 1,
  D: 2,
  F: 3,
  H: 4,
  G: 5,
  Z: 6,
  X: 7,
  C: 8,
  V: 9,
  B: 11,
  Q: 12,
  W: 13,
  E: 14,
  R: 15,
  Y: 16,
  T: 17,
  '1': 18,
  '2': 19,
  '3': 20,
  '4': 21,
  '6': 22,
  '5': 23,
  Equals: 24,
  Equal: 24,
  '9': 25,
  '7': 26,
  Minus: 27,
  '8': 28,
  '0': 29,
  RightBracket: 30,
  O: 31,
  U: 32,
  LeftBracket: 33,
  I: 34,
  P: 35,
  Enter: 36,
  L: 37,
  J: 38,
  Quote: 39,
  K: 40,
  Semicolon: 41,
  Backslash: 42,
  Comma: 43,
  Slash: 44,
  N: 45,
  M: 46,
  Period: 47,
  Tab: 48,
  Space: 49,
  Backquote: 50,
  Backspace: 51,
  Delete: 51,
  Return: 36,
  Escape: 53,
  Left: 123,
  Right: 124,
  Down: 125,
  Up: 126,
  Home: 115,
  End: 119,
  PageUp: 116,
  PageDown: 121,
  F1: 122,
  F2: 120,
  F3: 99,
  F4: 118,
  F5: 96,
  F6: 97,
  F7: 98,
  F8: 100,
  F9: 101,
  F10: 109,
  F11: 103,
  F12: 111
}

export const createMacPttBinding = (shortcut: CanonicalShortcut): MacPttBinding | null => {
  const keyCode = MAC_KEY_CODES[shortcut.key]

  if (keyCode === undefined) {
    return null
  }

  return {
    keyCode,
    modifiers: shortcut.modifiers
  }
}
