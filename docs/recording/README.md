# Recording Docs

This folder documents the recording subsystem (capture/runtime/artifact domain).

For top-level dictation/transcription lifecycle, see `docs/dictation`.

## Files

- `architecture.md` - component ownership, boundaries, and module map.
- `flows.md` - capture-domain runtime sequence flows.
- `contracts.md` - capture IPC channels, recording preload APIs, and recording state contracts.

## Fast path for new contributors

1. Read `architecture.md` first.
2. Read `flows.md` to understand lifecycle and failure paths.
3. Use `contracts.md` before changing IPC or shared types.
