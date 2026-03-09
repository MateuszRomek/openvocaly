# OpenVocaly Docs

This folder contains architecture and contract docs for the main subsystems.

## Recommended Reading Order

1. `docs/main/architecture.md`
2. `docs/dictation/architecture.md`
3. `docs/recording/architecture.md`
4. `docs/transcription/architecture.md`
5. `docs/paste/architecture.md`

## Subsystems

- `docs/main`
  - main-process composition root, lifecycle, dependency wiring, repositories, IPC pattern.
- `docs/dictation`
  - top-level dictation pipeline orchestration and overlay state lifecycle.
- `docs/recording`
  - capture runtime/artifact domain.
- `docs/transcription`
  - provider orchestration, local runtime/model management, and Models surface contracts.
- `docs/paste`
  - post-transcription clipboard and auto/manual paste flow.

## Source Of Truth

- Main process: `src/main/**`
- Renderer models/settings surfaces: `src/renderer/src/views/**`
- Shared contracts: `src/shared/**`
- Preload API bridge: `src/preload/index.ts`
