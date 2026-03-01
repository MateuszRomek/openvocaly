# Recording Docs

This folder documents the recording subsystem end-to-end (main process, preload bridge, renderer capture runtime, overlay runtime, and persisted artifacts).

## Files

- `architecture.md` - component ownership, boundaries, and module map.
- `flows.md` - runtime sequence flows for success, cancel, failure, and shutdown.
- `contracts.md` - IPC channels, preload/public APIs, and state contracts.

## Fast path for new contributors

1. Read `architecture.md` first.
2. Read `flows.md` to understand lifecycle and failure paths.
3. Use `contracts.md` before changing IPC or shared types.
