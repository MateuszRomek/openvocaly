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

- Node.js 22+ (see `.nvmrc`)
- npm 10+
- Git
- Internet connection for first runtime download

### macOS (current primary development target)

- Xcode Command Line Tools (`xcode-select -p`)
- Homebrew (recommended)

Notes:

- `npm run dev` runs runtime preparation automatically (`predev`).
- If local Whisper runtime binaries are already present in `resources/bin`, you do not need `cmake`.
- If Whisper runtime must be rebuilt, the script will try to install missing `git`/`cmake` via Homebrew.
- If Xcode Command Line Tools are missing, macOS will prompt install and you need to finish it before rerunning.

### Windows / Linux

- Windows and Linux are not active development targets right now.
- Current implementation is macOS-first; Windows/Linux support will be added in upcoming phases.

## Platform Status

OpenVocaly is currently developed and tested primarily on macOS.
Windows and Linux support is planned next, after the macOS-first phase.

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
On first run, this can take longer because local runtimes are prepared/downloaded.

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
