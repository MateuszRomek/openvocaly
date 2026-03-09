# Main Process Architecture

## Scope

`src/main` is the backend backbone for the desktop app. It owns:

- app bootstrap/shutdown lifecycle,
- IPC registration and handlers,
- domain orchestration services,
- repository-backed persistence access,
- in-process typed event transport.

## Composition Root

Main-process wiring is centralized in:

- `src/main/app-context.ts` (`createMainAppContext`)

This file creates and wires:

- repositories (`DatabaseLifecycle`, `SettingsRepository`, `ShortcutBindingsRepository`, `StorageRepository`),
- domain services (`recording`, `transcription`, `dictation pipeline`, `paste`, `shortcuts`, `permissions`),
- event buses (`recording.command`, `recording.session`, `recording.artifact-ready` wrappers),
- IPC modules (factory-based `create*IpcModule`).

No domain should instantiate cross-domain singletons directly; dependencies are injected from this composition root.

## Lifecycle

Bootstrap entrypoint:

- `src/main/index.ts`

Startup order:

1. initialize DB lifecycle,
2. register all IPC handlers,
3. initialize shortcuts/transcription/recording/pipeline modules,
4. create main window.

Shutdown order:

1. pipeline shutdown,
2. recording shutdown (bounded by timeout),
3. transcription shutdown,
4. shortcuts shutdown,
5. close database.

## IPC Pattern

IPC registration now follows a uniform module pattern:

- each domain exposes `create*IpcModule(...)`,
- each module exposes `registerIpcHandlers()` plus optional `initialize()`/`shutdown()`,
- duplicate `ipcMain.handle(...)` registration is prevented by shared helper:
  - `src/main/helpers/ipc.ts` (`createIpcRegistrar`).

## Repository Pattern

Database access is isolated under `src/main/repositories`:

- `database-lifecycle.ts` - explicit DB initialization boundary,
- `settings-repository.ts` - JSON settings in `app_settings`,
- `shortcut-bindings-repository.ts` - shortcut bindings persistence,
- `storage-repository.ts` - sessions/transcripts persistence and listings.

Service/store modules should consume repositories, not `getDb()`/`initDb()` directly.

## Eventing

In-process domain events use typed event bus contracts:

- shared event bus: `src/main/events/event-bus.ts`,
- event payload types: `src/main/events/event-bus-events.ts`,
- recording wrappers:
  - `src/main/recording/command-bus.ts`,
  - `src/main/recording/session-bus.ts`,
  - `src/main/recording/artifact-bus.ts`.

## Dependency Rules

- Domain orchestration in services, persistence in repositories, transport in IPC modules.
- Platform-specific behavior lives behind adapters/policies (for example paste/overlay macOS behavior).
- Shared contracts are defined in `src/shared/**`; avoid ad-hoc runtime payload shapes.
