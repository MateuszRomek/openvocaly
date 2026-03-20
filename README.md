# OpenVocaly

OpenVocaly is a desktop dictation app and my personal alternative to WisprFlow.
It is designed for system-wide dictation on macOS, so you can dictate and insert text across apps, not just inside one editor.

Built with AI-assisted engineering (Codex), it's still evolving, but it already gets the job done in day-to-day work.
If you are interested in the idea, open an issue or discussion on GitHub and we can talk through features, tradeoffs, and roadmap ideas.

## Project Status

- macOS only
- Windows and Linux are not planned right now

## Getting Started (Local Development)

### Prerequisites

- Node.js 22+ (see `.nvmrc`)
- npm 10+
- Git
- internet connection for first runtime download

### macOS Requirements

- Xcode Command Line Tools (`xcode-select -p`)
- Homebrew (recommended)

Notes:

- `npm run dev` runs runtime preparation automatically (`predev`)
- if local Whisper runtime binaries are already present in `resources/bin`, you do not need `cmake`
- if Whisper runtime must be rebuilt, the script will try to install missing `git`/`cmake` via Homebrew
- if Xcode Command Line Tools are missing, macOS prompts install and you need to finish it before rerunning

### Setup

1. Install dependencies:

```bash
npm install
```

2. Run local setup:

```bash
npm run setup:dev
```

This creates `.env` from `.env.example` if needed and applies local database migrations.

3. Start local development:

```bash
npm run dev
```

This runs Electron main process + renderer dev server together.
On first run, startup may take longer while local runtimes are prepared/downloaded.

## Local Configuration

Local development overrides live in `.env`.
If `.env` is missing, run `npm run setup:dev`.

Example values:

```bash
RENDERER_DEV_SERVER_PORT=5180
LOG_LEVEL=debug
LOG_PRETTY=1
```

Remove `RENDERER_DEV_SERVER_PORT` to use Vite default port behavior.

## Useful Scripts

```bash
# Initial local setup
npm run setup:dev

# Quality
npm run lint
npm run format
npm run typecheck

# Build app bundle
npm run build:mac
```

## Tech Stack

- Electron + electron-vite
- React + TypeScript
- TanStack Router + TanStack Query
- SQLite (via `@libsql/client`) + Drizzle ORM

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).
See `LICENSE` for details.
