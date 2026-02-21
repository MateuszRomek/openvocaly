import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

export type ShortcutConfigResponse = Awaited<ReturnType<typeof window.api.shortcuts.getConfig>>
export type ShortcutRuntimeStatusResponse = Awaited<
  ReturnType<typeof window.api.shortcuts.getRuntimeStatus>
>
export type ShortcutActionConfig = ShortcutConfigResponse['actions'][number]
export type ShortcutAction = ShortcutActionConfig['action']
export type ShortcutMutationResponse = Awaited<ReturnType<typeof window.api.shortcuts.update>>
export type ShortcutUpdateInput = Parameters<Window['api']['shortcuts']['update']>[0]
export type ShortcutResetInput = Parameters<Window['api']['shortcuts']['reset']>[0]
export type ShortcutPlatform = Window['api']['system']['platform']
export type ShortcutPttAvailability = ShortcutRuntimeStatusResponse['ptt']['availability']
export type ShortcutErrorCode = NonNullable<
  ShortcutMutationResponse['errorCode'] | ShortcutActionConfig['registrationError']
>

export type KeyboardCaptureEvent = Pick<
  ReactKeyboardEvent<HTMLElement>,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'
>
