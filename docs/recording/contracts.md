# Recording Contracts (IPC + Public API)

## Shared protocol source of truth

All recording protocol types/channels are defined in:

- `src/shared/recording.ts`

## Stable IPC channels

- `recording:capture-command`
- `recording:capture-event`
- `recording:capture-ready`

## Capture command contract

Main -> capture renderer:

- `start` `{ sessionId, format, soundCues }`
- `stop` `{}`
- `cancel` `{ reason, soundCues }`
- `playCue` `{ cue, soundCues }`

## Capture event contract

Capture renderer -> main:

- `started` `{ sessionId }`
- `chunk` `{ sessionId, chunk }`
- `meter` `{ sessionId, level, bands }`
- `stopped` `{ sessionId, durationMs }`
- `error` `{ sessionId | null, reason, message? }`

## Main IPC handlers (invoke)

Registered in `src/main/recording/ipc.ts`:

- `recording:getPreferences`
- `recording:updatePreferences`

## Preload public API

Exposed in `src/preload/index.ts`:

- `window.api.recording.getPreferences()`
- `window.api.recording.updatePreferences(input)`

## Runtime state phases (recording-domain)

- `idle`
- `starting`
- `recording`
- `stopping`
- `complete`
- `failed`

Failure reasons:

- `microphone_permission_denied`
- `capture_error`
- `aborted`
