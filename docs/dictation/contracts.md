# Dictation Contracts (IPC + Overlay)

## Shared protocol source of truth

All dictation protocol types/channels are defined in:

- `src/shared/dictation.ts`

## Stable overlay channel

- `dictation:overlay-state`

Payload type:

- `DictationOverlayState`

## Main IPC handlers (invoke)

Registered in `src/main/pipeline/ipc.ts`:

- `dictation:getRuntimeState`

## Preload public API

Exposed in `src/preload/index.ts`:

- `window.api.dictation.getRuntimeState()`

## Runtime phases

- `idle`
- `starting`
- `recording`
- `stopping`
- `transcribing`
- `complete`
- `failed`

Failure reasons:

- recording-domain reasons (`microphone_permission_denied`, `capture_error`, `aborted`)
- `transcription_error`
