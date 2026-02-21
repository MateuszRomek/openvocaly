import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query'
import type {
  AccessibilityRequestResponse,
  MicrophoneRequestResponse,
  OpenSystemSettingsResponse
} from './permissions.types'

export type RequestAccessibilityOptions = UseMutationOptions<
  AccessibilityRequestResponse,
  Error,
  void
>

export type OpenAccessibilitySettingsOptions = UseMutationOptions<
  OpenSystemSettingsResponse,
  Error,
  void
>

export type RequestMicrophoneOptions = UseMutationOptions<MicrophoneRequestResponse, Error, void>

export type OpenMicrophoneSettingsOptions = UseMutationOptions<
  OpenSystemSettingsResponse,
  Error,
  void
>

export type RequestAccessibilityMutationResult = UseMutationResult<
  AccessibilityRequestResponse,
  Error,
  void
>

export type OpenAccessibilitySettingsMutationResult = UseMutationResult<
  OpenSystemSettingsResponse,
  Error,
  void
>

export type RequestMicrophoneMutationResult = UseMutationResult<
  MicrophoneRequestResponse,
  Error,
  void
>

export type OpenMicrophoneSettingsMutationResult = UseMutationResult<
  OpenSystemSettingsResponse,
  Error,
  void
>
