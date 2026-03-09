# Transcription Contracts

## Shared Types

Source of truth:

- `src/shared/transcription.ts`
- `src/shared/local-transcription.ts`

Key contracts:

- `TranscriptionPreferences`, `TranscriptionConfig`, `TranscriptionResult`
- `TranscriptionFailureCode`
- `LocalModelInfo`, `LocalModelDownloadProgress`, `LocalRuntimeStatus`

## Main IPC Handlers

Registered in `src/main/transcription/ipc.ts`:

- `transcription:getPreferences`
- `transcription:updatePreferences`
- `transcription:setProviderApiKey`
- `transcription:clearProviderApiKey`
- `transcription:listLocalModels`
- `transcription:downloadLocalModel`
- `transcription:cancelLocalModelDownload`
- `transcription:deleteLocalModel`
- `transcription:getLocalRuntimeStatus`
- `transcription:startLocalRuntime`
- `transcription:stopLocalRuntime`

Event channel:

- `transcription:localModelDownloadProgress`

## Preload API

Exposed from `src/preload/index.ts` as `window.api.transcription`:

- `preferences.get()` / `preferences.update(...)`
- `cloud.setProviderApiKey(...)` / `cloud.clearProviderApiKey(...)`
- `local.listModels()`
- `local.downloadModel(...)`
- `local.cancelDownload()`
- `local.deleteModel(...)`
- `local.getRuntimeStatus()`
- `local.startRuntime(...)`
- `local.stopRuntime()`
- `local.onDownloadProgress(callback)`

## Provider/Model Notes

- Provider IDs include cloud providers and `local-parakeet`.
- Local model IDs are currently constrained to known local catalog entries.
- UI should rely on `TranscriptionConfig.providers` metadata instead of hardcoding provider capability assumptions.
- Models route defaults to local providers (`/models` -> `/models/local`) and tab order is `Local | Cloud`.
