# Paste Architecture

## Scope

The paste subsystem owns transcript post-processing after transcription succeeds:

- clipboard transaction capture/write/restore,
- auto-paste simulation when supported,
- fallback to manual paste session when needed,
- platform-specific behavior through adapters.

## Main Components

- `src/main/paste/service.ts` (`DictationPasteService`)
  - orchestration facade for paste flow.

- `src/main/paste/service/manual-fallback-session.ts`
  - generic timeout/countdown/manual-shortcut replay session logic.

- `src/main/paste/platform-adapter.ts`
  - platform adapter contract and capability model.

- `src/main/paste/adapters/*`
  - platform implementations (`macos`, `windows`, `linux`, `noop`).

## Platform Strategy

Paste behavior is feature-gated by adapter capabilities:

- if adapter `implementationState !== 'ready'`: return `not_supported` immediately,
- if accessibility permission is required and missing: return `permission_denied`,
- if auto-paste is enabled/safe: attempt auto-paste,
- otherwise run manual fallback session.

## macOS Adapter

The macOS adapter prefers native paste helper first, then AppleScript fallback:

1. resolve native helper binary candidates,
2. run `macos-fast-paste` with timeout,
3. if native path fails, fallback to AppleScript Cmd+V simulation.

Editable-target probe decisions are defined in:

- `src/main/paste/adapters/macos/probe-decisions.ts`

These decisions gate:

- whether auto-paste should run,
- whether manual Cmd+V replay should be ignored for non-editable targets.
