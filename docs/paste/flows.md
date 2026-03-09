# Paste Runtime Flows

## 1) Unsupported Platform (fail early)

1. adapter capabilities are evaluated,
2. if `implementationState` is not `ready`, flow returns `not_supported` immediately,
3. no manual fallback watcher/session is started.

## 2) Permission denied

1. if adapter requires accessibility permission,
2. and permission is missing,
3. flow returns `permission_denied`.

## 3) Auto-paste success

1. transcript is copied to clipboard,
2. editable probe decides auto-paste eligibility,
3. adapter simulates paste,
4. clipboard is restored after short delay,
5. outcome: `auto_paste_success`.

## 4) Auto-paste fallback to manual flow

1. transcript remains in clipboard,
2. manual fallback session starts timeout + countdown,
3. optional manual shortcut watcher listens for Cmd/Ctrl+V,
4. on valid manual trigger, adapter replays paste shortcut,
5. outcomes: `manual_paste_success`, `manual_timeout`, or `manual_cancelled`.

## 5) Clipboard safety invariant

Clipboard transaction is restored on all paths:

- explicit success restoration,
- finally-block restoration when any intermediate step fails.
