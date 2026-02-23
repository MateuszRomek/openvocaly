export type RecordingShortcutEvent = 'toggle' | 'push_to_talk_start' | 'push_to_talk_stop'

export const emitRecordingShortcutEvent = (event: RecordingShortcutEvent): void => {
  // Placeholder integration point until recording pipeline is implemented.
  console.info('[shortcuts] recording shortcut event', event)
}
