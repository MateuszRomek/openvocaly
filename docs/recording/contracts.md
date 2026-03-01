# Recording Contracts (IPC + Public API)

## Shared protocol source of truth

All recording protocol types/channels are defined in:

- `src/shared/recording.ts`

## Stable IPC channels

- `recording:capture-command`
- `recording:capture-event`
- `recording:capture-ready`
- `recording:overlay-state`

These names are treated as stable compatibility points between main and renderer runtimes.

## Capture command contract

Main -> capture renderer:

- `start` `{ sessionId, format, soundCues }`
- `stop` `{}`
- `cancel` `{ reason, soundCues }`

## Capture event contract

Capture renderer -> main:

- `chunk` `{ sessionId, chunk }`
- `meter` `{ sessionId, level, bands }`
- `stopped` `{ sessionId, durationMs }`
- `error` `{ sessionId | null, reason, message? }`

Note: the event name stays `meter` for compatibility even though UI wording may refer to "audio levels".

## Main IPC handlers (invoke)

Registered in `src/main/recording/ipc.ts`:

- `recording:getRuntimeState`
- `recording:getPreferences`
- `recording:updatePreferences`

## Preload public API

Exposed in `src/preload/index.ts`:

- `window.api.recording.getRuntimeState()`
- `window.api.recording.getPreferences()`
- `window.api.recording.updatePreferences(input)`

## Runtime state phases

- `idle`
- `starting`
- `recording`
- `stopping`
- `transcribing`
- `complete`
- `failed`

Failure reasons:

- `microphone_permission_denied`
- `capture_error`
- `transcription_error`
- `aborted`
