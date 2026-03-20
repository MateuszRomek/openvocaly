type ShortcutPlatform = 'darwin' | 'win32' | 'linux'
export type ShortcutCaptureKeyEvent = Pick<
  KeyboardEvent,
  | 'key'
  | 'code'
  | 'keyCode'
  | 'metaKey'
  | 'ctrlKey'
  | 'altKey'
  | 'shiftKey'
  | 'preventDefault'
  | 'stopPropagation'
>

const normalizeKey = (key: string): string | null => {
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
  event: ShortcutCaptureKeyEvent,
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

  return modifiers.length > 0 ? [...modifiers, key].join('+') : key
}

export const toDisplayAccelerator = (accelerator: string, platform: ShortcutPlatform): string => {
  const tokens = accelerator
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)

  return tokens
    .map((token) => {
      const lower = token.toLowerCase()
      if (lower === 'commandorcontrol') {
        return platform === 'darwin' ? '⌘' : 'Ctrl'
      }
      if (lower === 'command' || lower === 'cmd' || lower === 'meta' || lower === 'super') {
        return platform === 'darwin' ? '⌘' : platform === 'win32' ? 'Win' : 'Super'
      }
      if (lower === 'control' || lower === 'ctrl') {
        return platform === 'darwin' ? '⌃' : 'Ctrl'
      }
      if (lower === 'alt' || lower === 'option') {
        return platform === 'darwin' ? '⌥' : 'Alt'
      }
      if (lower === 'shift') {
        return platform === 'darwin' ? '⇧' : 'Shift'
      }
      if (token === 'Space') {
        return 'Space'
      }
      return token.length === 1 ? token.toUpperCase() : token
    })
    .join(' + ')
}
