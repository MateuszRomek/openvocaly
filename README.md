# OpenVocaly

OpenVocaly turns your voice into ready-to-use text anywhere you work.
Press a shortcut, speak naturally, and insert the transcription into your current app without breaking flow.

## Vision

We are building a polished macOS-first dictation experience in the spirit of tools like WhisperFlow:

- trigger recording instantly with shortcuts
- get fast, reliable transcription
- insert text directly into your current workflow
- keep the interaction lightweight with live overlay feedback

## Tech Stack

- Electron + electron-vite
- React + TypeScript
- TanStack Router + TanStack Query
- SQLite (`better-sqlite3`) + Drizzle ORM

## Prerequisites

- Node.js 22+
- npm 10+
- macOS, Linux, or Windows

## Platform Status

OpenVocaly is currently developed and tested primarily on macOS.
Windows and Linux support are planned, but should be treated as work in progress for now.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start local development:

```bash
npm run dev
```

This runs the Electron main process and renderer dev server together.

## Local Configuration

Optional renderer port override is defined in `.env.development`:

```bash
RENDERER_DEV_SERVER_PORT=5180
```

Remove the variable to fall back to Vite default port behavior.

## Useful Scripts

```bash
# Quality
npm run lint
npm run format
npm run typecheck

# Database
npm run db:generate
npm run db:migrate

# Build app bundles
npm run build:mac
npm run build:win
npm run build:linux
```

## Project Structure

- `src/main` - Electron main process, composition root, IPC modules, services, repositories
- `src/preload` - secure bridge exposed to renderer
- `src/renderer` - React UI and capture runtime
- `src/shared` - IPC contracts and shared types
- `docs` - architecture/flow/contract docs for main, dictation, recording, transcription, and paste

## Build Output

- `npm run build` creates production Electron assets
- platform scripts (`build:mac`, `build:win`, `build:linux`) create distributables with `electron-builder`

## Documentation

Start with `docs/README.md` for subsystem map and recommended reading order.

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).
See the `LICENSE` file for details.
