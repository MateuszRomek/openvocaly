export type RecordingShortcutEvent = 'toggle'

export const emitRecordingShortcutEvent = (event: RecordingShortcutEvent): void => {
  // Placeholder integration point until recording pipeline is implemented.
  console.info('[shortcuts] recording shortcut event', event)
}
