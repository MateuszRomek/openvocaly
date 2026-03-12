import {
  SHORTCUT_ACTIONS,
  isShortcutAction,
  type ShortcutAction,
  type ShortcutErrorCode,
  type ShortcutRuntimeStatusResponse
} from '../../../shared/shortcuts'
import type { PersistedShortcutBinding } from '../accelerator'
import { SUPPORTED_GLOBAL_ACTIONS } from '../constants'
import type { SupportedGlobalShortcutAction } from './global-shortcut'
import { mapPttAvailabilityToMutationError } from './ptt-errors'

const isSupportedGlobalAction = (action: ShortcutAction): action is SupportedGlobalShortcutAction =>
  SUPPORTED_GLOBAL_ACTIONS.has(action)

export type ShortcutUpdateDecision =
  | {
      type: 'error'
      errorCode: ShortcutErrorCode
    }
  | {
      type: 'apply_supported'
      action: SupportedGlobalShortcutAction
      binding: PersistedShortcutBinding
    }
  | {
      type: 'apply_ptt'
      binding: PersistedShortcutBinding
    }

type ShortcutUpdateDecisionInput = {
  action: string
  binding: PersistedShortcutBinding | null
  hasDuplicateAccelerator: boolean
  pttReady: boolean
  pttAvailability: ShortcutRuntimeStatusResponse['ptt']['availability']
}

export const decideShortcutUpdate = ({
  action,
  binding,
  hasDuplicateAccelerator,
  pttReady,
  pttAvailability
}: ShortcutUpdateDecisionInput): ShortcutUpdateDecision => {
  if (!isShortcutAction(action)) {
    return { type: 'error', errorCode: 'unsupported_action' }
  }

  if (!binding) {
    return { type: 'error', errorCode: 'invalid_accelerator' }
  }

  if (hasDuplicateAccelerator) {
    return { type: 'error', errorCode: 'duplicate_accelerator' }
  }

  if (action === 'recording.push_to_talk') {
    if (!pttReady) {
      return {
        type: 'error',
        errorCode: mapPttAvailabilityToMutationError(pttAvailability)
      }
    }

    return { type: 'apply_ptt', binding }
  }

  if (!isSupportedGlobalAction(action)) {
    return { type: 'error', errorCode: 'unsupported_action' }
  }

  return { type: 'apply_supported', action, binding }
}

export type ShortcutResetOperation =
  | {
      type: 'apply_supported'
      action: SupportedGlobalShortcutAction
      binding: PersistedShortcutBinding
    }
  | {
      type: 'apply_ptt'
      binding: PersistedShortcutBinding
    }
  | {
      type: 'persist_ptt'
      binding: PersistedShortcutBinding
    }

export type ShortcutResetDecision =
  | {
      type: 'error'
      errorCode: ShortcutErrorCode
    }
  | {
      type: 'operations'
      operations: ShortcutResetOperation[]
    }

type ShortcutResetDecisionInput = {
  action?: string
  pttReady: boolean
  defaultBindingForAction: (action: ShortcutAction) => PersistedShortcutBinding
}

export const decideShortcutReset = ({
  action,
  pttReady,
  defaultBindingForAction
}: ShortcutResetDecisionInput): ShortcutResetDecision => {
  if (!action) {
    const operations: ShortcutResetOperation[] = []

    for (const supportedAction of SHORTCUT_ACTIONS) {
      if (supportedAction === 'recording.push_to_talk') {
        operations.push(
          pttReady
            ? {
                type: 'apply_ptt',
                binding: defaultBindingForAction('recording.push_to_talk')
              }
            : {
                type: 'persist_ptt',
                binding: defaultBindingForAction('recording.push_to_talk')
              }
        )
        continue
      }

      if (!isSupportedGlobalAction(supportedAction)) {
        continue
      }

      operations.push({
        type: 'apply_supported',
        action: supportedAction,
        binding: defaultBindingForAction(supportedAction)
      })
    }

    return {
      type: 'operations',
      operations
    }
  }

  if (!isShortcutAction(action)) {
    return { type: 'error', errorCode: 'unsupported_action' }
  }

  if (action === 'recording.push_to_talk') {
    return {
      type: 'operations',
      operations: [
        pttReady
          ? { type: 'apply_ptt', binding: defaultBindingForAction(action) }
          : { type: 'persist_ptt', binding: defaultBindingForAction(action) }
      ]
    }
  }

  if (!isSupportedGlobalAction(action)) {
    return { type: 'error', errorCode: 'unsupported_action' }
  }

  return {
    type: 'operations',
    operations: [
      {
        type: 'apply_supported',
        action,
        binding: defaultBindingForAction(action)
      }
    ]
  }
}
