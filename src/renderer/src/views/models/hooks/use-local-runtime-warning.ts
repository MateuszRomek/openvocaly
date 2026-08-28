import { useMemo } from 'react'
import { supportsLocalRuntimeActions } from '../constants/local-provider-capabilities'
import { useLocalRuntimeStatusQuery } from '@renderer/queries/transcription/use-local-runtime-status-query'

type UseLocalRuntimeWarningResult = {
  warning: string | null
  runtimeError: unknown
}

type UseLocalRuntimeWarningOptions = {
  enabled?: boolean
}

type LocalProviderId = Parameters<
  Window['api']['transcription']['local']['getRuntimeStatus']
>[0]['providerId']

const RUNTIME_UNAVAILABLE_MESSAGE_BY_PROVIDER: Record<LocalProviderId, string> = {
  'local-parakeet':
    'The macOS Parakeet host is unavailable. It should be prepared automatically on npm run dev/build. If it remains unavailable, reinstall the app.',
  'local-whisper':
    'Local runtime binary not found. It should be prepared automatically on npm run dev/build. If still missing, run npm run build:whisper-cpp-runtime and restart app.',
  'local-qwen':
    'The bundled Qwen MLX host is unavailable. It should be prepared automatically on npm run dev/build. Rebuild the local runtime and restart the app.'
}

const getProviderLabel = (providerId: LocalProviderId): string => {
  if (providerId === 'local-whisper') {
    return 'Local Whisper'
  }
  if (providerId === 'local-qwen') {
    return 'Local Qwen'
  }
  return 'Local Parakeet'
}

export const useLocalRuntimeWarning = (
  providerId: LocalProviderId,
  options: UseLocalRuntimeWarningOptions = {}
): UseLocalRuntimeWarningResult => {
  const shouldCheckRuntime = supportsLocalRuntimeActions(providerId) && options.enabled !== false
  const runtimeStatusQuery = useLocalRuntimeStatusQuery(providerId, {
    enabled: shouldCheckRuntime
  })
  const runtimeStatus = runtimeStatusQuery.data?.status ?? null

  const warning = useMemo(() => {
    if (!supportsLocalRuntimeActions(providerId)) {
      return null
    }

    if (!runtimeStatus) {
      return null
    }

    if (runtimeStatus.platformSupported && runtimeStatus.available) {
      return null
    }

    if (!runtimeStatus.platformSupported) {
      if (providerId === 'local-parakeet') {
        return 'Local Parakeet currently requires Apple Silicon and macOS 14 or newer.'
      }
      if (providerId === 'local-qwen') {
        return 'Local Qwen currently requires Apple Silicon and macOS 13 or newer.'
      }
      return `${getProviderLabel(providerId)} is currently supported on macOS only in this release.`
    }

    return RUNTIME_UNAVAILABLE_MESSAGE_BY_PROVIDER[providerId]
  }, [providerId, runtimeStatus])

  return {
    warning,
    runtimeError: shouldCheckRuntime ? runtimeStatusQuery.error : null
  }
}
