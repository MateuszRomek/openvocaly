import { useCallback, useMemo } from 'react'
import { PERMISSION_ITEMS, shouldRenderPermissionMessage } from '../constants/permissions'
import { useOpenAccessibilitySettingsMutation } from '../queries/permissions/use-open-accessibility-settings-mutation'
import { useOpenMicrophoneSettingsMutation } from '../queries/permissions/use-open-microphone-settings-mutation'
import { usePermissionsStatusQuery } from '../queries/permissions/use-permissions-status-query'
import { useRequestAccessibilityMutation } from '../queries/permissions/use-request-accessibility-mutation'
import { useRequestMicrophoneMutation } from '../queries/permissions/use-request-microphone-mutation'
import type {
  PermissionState,
  PermissionsStatusResponse
} from '../queries/permissions/permissions.types'

type PermissionConfig = Record<
  (typeof PERMISSION_ITEMS)[number]['key'],
  {
    state: PermissionState
    message?: string
    isRequesting: boolean
    isOpeningSettings: boolean
    onRequest: () => void
    onOpenSettings: () => void
  }
>

export type UsePermissionsControllerResult = {
  requestError: string | null
  permissionsStatus: PermissionsStatusResponse | null
  permissionConfig: PermissionConfig
  isLoading: boolean
  isRequestingAccessibility: boolean
  isOpeningAccessibilitySettings: boolean
  isRequestingMicrophone: boolean
  isOpeningMicrophoneSettings: boolean
  requestAccessibility: () => void
  openAccessibilitySettings: () => void
  requestMicrophone: () => void
  openMicrophoneSettings: () => void
  refresh: () => void
}

export function usePermissions(): UsePermissionsControllerResult {
  const permissionsStatusQuery = usePermissionsStatusQuery()
  const requestAccessibilityMutation = useRequestAccessibilityMutation()
  const requestMicrophoneMutation = useRequestMicrophoneMutation()
  const openAccessibilitySettingsMutation = useOpenAccessibilitySettingsMutation()
  const openMicrophoneSettingsMutation = useOpenMicrophoneSettingsMutation()

  const requestError = useMemo(() => {
    if (permissionsStatusQuery.isError) {
      return 'Could not load permission status.'
    }

    if (requestAccessibilityMutation.isError) {
      return 'Could not request Accessibility access.'
    }

    if (openAccessibilitySettingsMutation.isError) {
      return 'Could not open Accessibility settings.'
    }

    if (requestMicrophoneMutation.isError) {
      return 'Could not request microphone access.'
    }

    if (openMicrophoneSettingsMutation.isError) {
      return 'Could not open microphone settings.'
    }

    return null
  }, [
    openAccessibilitySettingsMutation.isError,
    openMicrophoneSettingsMutation.isError,
    requestAccessibilityMutation.isError,
    requestMicrophoneMutation.isError,
    permissionsStatusQuery.isError
  ])

  const requestAccessibility = useCallback((): void => {
    requestAccessibilityMutation.mutate()
  }, [requestAccessibilityMutation])

  const openAccessibilitySettings = useCallback((): void => {
    openAccessibilitySettingsMutation.mutate()
  }, [openAccessibilitySettingsMutation])

  const requestMicrophone = useCallback((): void => {
    requestMicrophoneMutation.mutate()
  }, [requestMicrophoneMutation])

  const openMicrophoneSettings = useCallback((): void => {
    openMicrophoneSettingsMutation.mutate()
  }, [openMicrophoneSettingsMutation])

  const refreshPermissions = useCallback((): void => {
    void permissionsStatusQuery.refetch()
  }, [permissionsStatusQuery])

  const permissionsStatus = permissionsStatusQuery.data ?? null
  const microphoneState = permissionsStatus?.microphone.state ?? 'unknown'
  const accessibilityState = permissionsStatus?.accessibility.state ?? 'unknown'
  const microphoneMessage = shouldRenderPermissionMessage(microphoneState)
    ? permissionsStatus?.microphone.message
    : undefined
  const accessibilityMessage = shouldRenderPermissionMessage(accessibilityState)
    ? permissionsStatus?.accessibility.message
    : undefined

  const permissionConfig = {
    microphone: {
      state: microphoneState,
      message: microphoneMessage,
      isRequesting: requestMicrophoneMutation.isPending,
      isOpeningSettings: openMicrophoneSettingsMutation.isPending,
      onRequest: requestMicrophone,
      onOpenSettings: openMicrophoneSettings
    },
    accessibility: {
      state: accessibilityState,
      message: accessibilityMessage,
      isRequesting: requestAccessibilityMutation.isPending,
      isOpeningSettings: openAccessibilitySettingsMutation.isPending,
      onRequest: requestAccessibility,
      onOpenSettings: openAccessibilitySettings
    }
  } satisfies PermissionConfig

  return {
    requestError,
    permissionsStatus,
    permissionConfig,
    isLoading: permissionsStatusQuery.isPending,
    isRequestingAccessibility: requestAccessibilityMutation.isPending,
    isOpeningAccessibilitySettings: openAccessibilitySettingsMutation.isPending,
    isRequestingMicrophone: requestMicrophoneMutation.isPending,
    isOpeningMicrophoneSettings: openMicrophoneSettingsMutation.isPending,
    requestAccessibility,
    openAccessibilitySettings,
    requestMicrophone,
    openMicrophoneSettings,
    refresh: refreshPermissions
  }
}
