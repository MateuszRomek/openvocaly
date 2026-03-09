import type { DictationOverlayState } from './dictation'

const ERROR_WIDTH_MIN = 240
const ERROR_WIDTH_MAX = 380
const ERROR_HEIGHT_SINGLE_LINE = 46
const ERROR_HEIGHT_MAX = 86
const ERROR_CHROME_WIDTH = 112
const MANUAL_PASTE_WIDTH = 262
const MANUAL_PASTE_HEIGHT = 50
const AVERAGE_CHARACTER_WIDTH = 7.1
const ERROR_LINE_HEIGHT = 16
const ERROR_LINE_COUNT_MAX = 3
const MAX_ERROR_MESSAGE_LENGTH = 140

export type OverlayWindowSize = {
  width: number
  height: number
}

const clamp = (value: number, min: number, max: number): number => {
  if (value <= min) {
    return min
  }

  if (value >= max) {
    return max
  }

  return value
}

const normalizeLine = (value: string): string => value.replace(/\s+/g, ' ').trim()

const trimTrailingPeriod = (value: string): string => value.replace(/\.+$/, '')

const stripProviderPrefix = (value: string): string =>
  value.replace(/^[\w\s-]+ request failed:\s*/i, '')

const truncate = (value: string, maxLength: number): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trimEnd()}...`

export const resolveOverlayMessage = (
  state: Pick<DictationOverlayState, 'phase' | 'failureReason' | 'message' | 'manualPaste'>
): string | null => {
  if (state.phase === 'awaiting_manual_paste') {
    return state.manualPaste ? 'Paste when ready' : 'Waiting for manual paste'
  }

  if (state.phase !== 'failed') {
    return null
  }

  if (state.failureReason === 'paste_not_supported') {
    return 'Auto-paste not supported on this platform'
  }

  if (state.failureReason === 'paste_permission_denied') {
    return 'Allow Accessibility to use auto-paste'
  }

  if (state.failureReason === 'paste_runtime_error') {
    const message = (state.message ?? '').trim()
    return message.length > 0
      ? truncate(normalizeLine(message), MAX_ERROR_MESSAGE_LENGTH)
      : 'Auto-paste failed'
  }

  if (state.failureReason === 'aborted') {
    return null
  }

  const rawMessage = (state.message ?? '').trim()
  if (!rawMessage) {
    return null
  }

  const normalized = rawMessage.toLowerCase()

  if (normalized.includes('not configured') || normalized.includes('add an api key')) {
    return 'Missing API key'
  }

  if (
    normalized.includes('invalid api key') ||
    normalized.includes('invalid_api_key') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden')
  ) {
    return 'Invalid API key'
  }

  if (normalized.includes('microphone permission')) {
    return 'Microphone permission denied'
  }

  if (normalized.includes('empty transcription')) {
    return 'No speech detected'
  }

  if (normalized.includes('model is not downloaded')) {
    return 'Local model not downloaded'
  }

  if (normalized.includes('runtime is unavailable') || normalized.includes('runtime binary')) {
    return 'Local runtime unavailable'
  }

  const lines = rawMessage
    .split(/\r?\n/)
    .map((line) => normalizeLine(trimTrailingPeriod(stripProviderPrefix(line))))
    .filter(Boolean)

  const cleaned = lines.join('\n')
  return truncate(cleaned, MAX_ERROR_MESSAGE_LENGTH)
}

export const resolveOverlayWindowSize = (
  state: Pick<DictationOverlayState, 'phase' | 'failureReason' | 'message' | 'manualPaste'> | null,
  defaultSize: OverlayWindowSize
): OverlayWindowSize => {
  if (!state) {
    return defaultSize
  }

  if (state.phase === 'awaiting_manual_paste') {
    return {
      width: MANUAL_PASTE_WIDTH,
      height: MANUAL_PASTE_HEIGHT
    }
  }

  const message = resolveOverlayMessage(state)
  if (!message) {
    return defaultSize
  }

  const longestLineLength = message.split('\n').reduce((max, line) => Math.max(max, line.length), 0)
  const estimatedTextWidth = Math.round(longestLineLength * AVERAGE_CHARACTER_WIDTH)
  const width = clamp(estimatedTextWidth + ERROR_CHROME_WIDTH, ERROR_WIDTH_MIN, ERROR_WIDTH_MAX)
  const estimatedCharsPerLine = Math.max(
    16,
    Math.floor((width - ERROR_CHROME_WIDTH) / AVERAGE_CHARACTER_WIDTH)
  )
  const explicitLines = message.split('\n')
  const wrappedLineCount = explicitLines.reduce((sum, line) => {
    const length = line.length || 1
    return sum + Math.max(1, Math.ceil(length / estimatedCharsPerLine))
  }, 0)
  const lineCount = clamp(wrappedLineCount, 1, ERROR_LINE_COUNT_MAX)
  const height = clamp(
    ERROR_HEIGHT_SINGLE_LINE + (lineCount - 1) * ERROR_LINE_HEIGHT,
    ERROR_HEIGHT_SINGLE_LINE,
    ERROR_HEIGHT_MAX
  )

  return {
    width,
    height
  }
}
