import { useEffect, useMemo } from 'react'
import type { PermissionState } from '../../../../../../shared/permissions'
import { useOpenAccessibilitySettingsMutation } from '@renderer/queries/permissions/use-open-accessibility-settings-mutation'
import { useOpenMicrophoneSettingsMutation } from '@renderer/queries/permissions/use-open-microphone-settings-mutation'
import { usePermissionsStatusQuery } from '@renderer/queries/permissions/use-permissions-status-query'
import { useRequestAccessibilityMutation } from '@renderer/queries/permissions/use-request-accessibility-mutation'
import { useRequestMicrophoneMutation } from '@renderer/queries/permissions/use-request-microphone-mutation'

export type UsePermissionsStepResult = {
  showPlatformNotice: boolean
  canRequestMicrophone: boolean
  canRequestAccessibility: boolean
  isComplete: boolean
  isMacOS: boolean
  ready: boolean
  microphoneState: PermissionState
  accessibilityState: PermissionState
  microphoneGranted: boolean
  accessibilityGranted: boolean
  microphoneReady: boolean
  accessibilityReady: boolean
  microphoneUnsupported: boolean
  accessibilityUnsupported: boolean
  loading: boolean
  message: string | null
  requestMicrophone: () => void
  openMicrophoneSettings: () => void
  requestAccessibility: () => void
  openAccessibilitySettings: () => void
}

const isPermissionReady = (state: PermissionState): boolean =>
  state === 'granted' || state === 'unsupported_platform'

export function usePermissionsStep(): UsePermissionsStepResult {
  const permissionsStatusQuery = usePermissionsStatusQuery()
  const requestMicrophoneMutation = useRequestMicrophoneMutation()
  const openMicrophoneSettingsMutation = useOpenMicrophoneSettingsMutation()
  const requestAccessibilityMutation = useRequestAccessibilityMutation()
  const openAccessibilitySettingsMutation = useOpenAccessibilitySettingsMutation()
  const refetchPermissionsStatus = permissionsStatusQuery.refetch

  const platform = window.api.system.platform
  const isMacOS = platform === 'darwin'
  const permissionsStatus = permissionsStatusQuery.data
  const microphoneState = permissionsStatus?.microphone.state ?? 'unknown'
  const accessibilityState = permissionsStatus?.accessibility.state ?? 'unknown'
  const microphoneGranted = microphoneState === 'granted'
  const accessibilityGranted = accessibilityState === 'granted'
  const microphoneReady = isPermissionReady(microphoneState)
  const accessibilityReady = isPermissionReady(accessibilityState)
  const microphoneUnsupported = microphoneState === 'unsupported_platform'
  const accessibilityUnsupported = accessibilityState === 'unsupported_platform'
  const permissionsReady = microphoneReady && accessibilityReady

  useEffect(() => {
    if (permissionsReady) {
      return
    }

    const refetchStatus = (): void => {
      void refetchPermissionsStatus()
    }

    const onWindowFocus = (): void => {
      refetchStatus()
    }

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        refetchStatus()
      }
    }

    const intervalId = window.setInterval(refetchStatus, 1200)
    window.addEventListener('focus', onWindowFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', onWindowFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [permissionsReady, refetchPermissionsStatus])

  const permissionErrorMessage = useMemo(() => {
    if (permissionsStatusQuery.isError) {
      return 'Could not load permission status.'
    }

    if (requestMicrophoneMutation.isError) {
      return 'Microphone request failed. Try again.'
    }

    if (requestAccessibilityMutation.isError) {
      return 'Accessibility request failed. Try again.'
    }

    return null
  }, [
    permissionsStatusQuery.isError,
    requestAccessibilityMutation.isError,
    requestMicrophoneMutation.isError
  ])

  return {
    showPlatformNotice: !isMacOS,
    canRequestMicrophone: !microphoneReady,
    canRequestAccessibility: !accessibilityReady,
    isComplete: permissionsReady,
    isMacOS,
    ready: permissionsReady,
    microphoneState,
    accessibilityState,
    microphoneGranted,
    accessibilityGranted,
    microphoneReady,
    accessibilityReady,
    microphoneUnsupported,
    accessibilityUnsupported,
    loading: permissionsStatusQuery.isPending,
    message: permissionErrorMessage,
    requestMicrophone: () => {
      requestMicrophoneMutation.mutate()
    },
    openMicrophoneSettings: () => {
      openMicrophoneSettingsMutation.mutate()
    },
    requestAccessibility: () => {
      requestAccessibilityMutation.mutate()
    },
    openAccessibilitySettings: () => {
      openAccessibilitySettingsMutation.mutate()
    }
  }
}
