import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query'
import type {
  ShortcutMutationResponse,
  ShortcutResetInput,
  ShortcutUpdateInput
} from './shortcuts.types'

export type UpdateShortcutOptions = UseMutationOptions<
  ShortcutMutationResponse,
  Error,
  ShortcutUpdateInput
>

export type ResetShortcutOptions = UseMutationOptions<
  ShortcutMutationResponse,
  Error,
  ShortcutResetInput | undefined
>

export type UpdateShortcutMutationResult = UseMutationResult<
  ShortcutMutationResponse,
  Error,
  ShortcutUpdateInput
>

export type ResetShortcutMutationResult = UseMutationResult<
  ShortcutMutationResponse,
  Error,
  ShortcutResetInput | undefined
>
