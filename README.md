# OpenVocaly

OpenVocaly is a local-first desktop dictation app and my personal alternative to WisprFlow.
It is designed for system-wide dictation on macOS, so you can dictate and insert text across apps, not just inside one editor.

Built with AI-assisted engineering (Codex), it's still evolving, but it already gets the job done in day-to-day work.
If you are interested in the idea, open an issue or discussion on GitHub and we can talk through features, tradeoffs, and roadmap ideas.

## Project Status

- macOS only
- Apple Silicon and macOS 14+ for the default Parakeet engine
- Windows and Linux are not planned right now

## Getting Started (Local Development)

### Prerequisites

- Node.js 24 (pinned in `.nvmrc`; the install script switches to it through nvm when nvm is installed)
- npm 10+
- Git
- Python 3 with `venv` and `pip` (builds the bundled Qwen MLX host)
- internet connection for the first runtime and model download

### macOS Requirements

- Xcode Command Line Tools (`xcode-select -p`)
- Homebrew (recommended)

Notes:

- `npm run dev` runs runtime preparation automatically (`predev`)
- the macOS Parakeet host is built with Swift Package Manager and a pinned FluidAudio revision
- if local Whisper runtime binaries are already present in `resources/bin`, you do not need `cmake`
- if Whisper runtime must be rebuilt, the script will try to install missing `git`/`cmake` via Homebrew
- if Xcode Command Line Tools are missing, macOS prompts install and you need to finish it before rerunning
- the Qwen MLX host is packaged as a self-contained Apple Silicon executable; end users do not need Python or `pip`

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
On first run, startup may take longer while local runtimes are prepared and models are downloaded.

## Build and install the macOS app locally

OpenVocaly is built from source on each Mac. No Apple Developer account is needed. These steps work on any Apple Silicon Mac running macOS 14 or later.

Once per Mac, create a local code signing certificate:

```bash
./scripts/setup-macos-signing.sh
```

macOS asks for your password once to trust it. The certificate stays in your login keychain and never leaves the Mac. Signing with a stable identity lets macOS keep the Microphone and Accessibility permissions across rebuilds. Without it the app is ad-hoc signed, and you grant both permissions again after every install.

Then build and install:

```bash
./scripts/build-and-install-macos.sh
```

The script checks the machine first (Apple Silicon, macOS version, Node, Python, a working Swift and C toolchain, free disk space) and stops with a fix if something is missing. It then installs the locked npm dependencies, builds the native transcription runtimes and the app, verifies the bundle and its signature, quits a running OpenVocaly, replaces `/Applications/OpenVocaly.app` (restoring the previous copy if the swap fails), and launches it. If the signing identity changed since the last install, it resets the old permission grants so macOS asks again cleanly.

To update a Mac to the latest code:

```bash
./scripts/build-and-install-macos.sh --update
```

Useful options:

```bash
# Only check that this Mac can build the app
./scripts/build-and-install-macos.sh --check

# Build without installing
./scripts/build-and-install-macos.sh --no-install

# Also produce the DMG and ZIP in dist/
./scripts/build-and-install-macos.sh --artifacts

# Reuse node_modules, or rebuild the native transcription runtimes
./scripts/build-and-install-macos.sh --skip-deps
./scripts/build-and-install-macos.sh --force-runtimes
```

Run `./scripts/build-and-install-macos.sh --help` for the full list. The first build takes a while because it compiles the local runtimes. Model weights are downloaded separately into OpenVocaly's application data from the **Local models** screen.

After the first install, grant Microphone and Accessibility access when OpenVocaly asks, then restart it.

## Local transcription

OpenVocaly does not send dictation audio to a cloud transcription provider. The app currently ships three deliberate local choices:

- **Parakeet v3** — the default Apple Silicon engine. A long-lived native Swift host loads the CoreML model with CPU + Apple Neural Engine placement, avoiding a local HTTP server and GPU-first execution. It is warmed after startup or model selection so the first dictation does not pay the full model-load cost.
- **Whisper Turbo Q5** — a compact Whisper.cpp fallback (about 574 MB). It replaces the previous Medium, Large v3, and full Turbo picker entries.
- **Qwen3-ASR (MLX)** — two Apple Silicon options: 0.6B for lower memory use and 1.7B for higher-quality transcription. The app downloads pinned MLX Community revisions into its own storage, validates the model payload, and keeps only the selected model warm in a separate MLX/Metal host.

Models are installed under OpenVocaly’s application data directory, not the system cache. They can be downloaded, deleted, and reinstalled from the **Local models** screen. The first Parakeet installation downloads the Apache-2.0 FluidAudio CoreML conversion from Hugging Face; later dictations run offline.

Qwen models are macOS 13+ and Apple-Silicon-only. Their bundled runtime is pinned to `qwen3-asr-mlx`; its inference code is MIT-licensed, while the Qwen model weights are Apache-2.0. The 0.6B and 1.7B downloads are about 1.6 GB and 4.1 GB respectively.

The dictation pipeline remains: record → normalize audio → local transcription → clipboard transaction and optional auto-paste. Meeting transcription is intentionally not part of this refactor.

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
npm test

# Rebuild the native Parakeet host after changing its Swift sources
npm run build:macos-asr-host -- --force

# Rebuild the self-contained Qwen MLX host after changing its Python source
npm run build:qwen-mlx-host -- --force

# Compare local Whisper runtime policies without printing transcription text
npm run benchmark:whisper -- --audio /absolute/path/to/audio.webm --model /absolute/path/to/ggml-large-v3-turbo-q5_0.bin --threads 2

# Build app bundle
npm run build:mac

# Build and install the local macOS app
./scripts/build-and-install-macos.sh
```

## Tech Stack

- Electron + electron-vite
- React + TypeScript
- TanStack Router + TanStack Query
- SQLite (via `@libsql/client`) + Drizzle ORM

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).
See `LICENSE` for details.
