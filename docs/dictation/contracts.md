# Dictation Contracts (IPC + Overlay)

## Shared protocol source of truth

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
- `awaiting_manual_paste`
- `complete`
- `failed`

## Dictation failure reasons

- recording-domain reasons:
  - `microphone_permission_denied`
  - `capture_error`
  - `aborted`
- dictation-domain reasons:
  - `transcription_error`
  - `paste_not_supported`
  - `paste_permission_denied`
  - `paste_runtime_error`

## Manual paste state payload

When phase is `awaiting_manual_paste`, state may include:

- `remainingMs`
- `timeoutMs`
- `hint`
