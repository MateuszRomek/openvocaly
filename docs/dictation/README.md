# Dictation Docs

This folder documents the top-level dictation pipeline subsystem.

## Files

- `architecture.md` - top-level ownership and module boundaries.
- `flows.md` - dictation lifecycle flows and failure behavior.
- `contracts.md` - shared types, overlay channel, and IPC APIs.

## Fast path for new contributors

1. Read `architecture.md` first.
2. Read `flows.md` for end-to-end lifecycle.
3. Use `contracts.md` before changing shared APIs/channels.
