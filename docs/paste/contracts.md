# Paste Contracts

## Shared Interfaces

Source files:

- `src/main/paste/platform-adapter.ts`
- `src/main/paste/service/types.ts`

## Adapter Contract

`PastePlatformAdapter` methods:

- `capabilities()`
- `probeEditableTarget()`
- `evaluateAutoPasteProbe?(probeResult)`
- `evaluateManualPasteProbe?(probeResult)`
- `simulatePasteShortcut()`
- `startManualPasteWatcher(onPasteShortcut)`
- `stopManualPasteWatcher()`

Capability flags (`PastePlatformCapabilities`):

- `platform`
- `implementationState`
- `supportsAutoPaste`
- `supportsEditableProbe`
- `supportsManualPasteWatcher`
- `requiresAccessibilityPermission`

## Service Outcomes

`DictationPasteOutcome`:

- `auto_paste_success`
- `manual_paste_success`
- `manual_timeout`
- `manual_cancelled`
- `permission_denied`
- `not_supported`
- `error`

`ManualPasteState` includes:

- `remainingMs`
- `timeoutMs`
- `hint`

## Timing Constants

Defined in `src/main/paste/service/constants.ts`:

- manual fallback timeout,
- post-paste clipboard restore delays,
- manual shortcut replay delay.
