import { useMemo } from 'react'
import { supportsLocalRuntimeActions } from '../constants/local-provider-capabilities'
import { useLocalRuntimeStatusQuery } from '../queries/transcription/use-local-runtime-status-query'

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
    'Local runtime binary not found. It should be prepared automatically on npm run dev/build. If still missing, run npm run download:sherpa-onnx and restart app.',
  'local-whisper':
    'Local runtime binary not found. It should be prepared automatically on npm run dev/build. If still missing, run npm run build:whisper-cpp-runtime and restart app.'
}

const getProviderLabel = (providerId: LocalProviderId): string => {
  return providerId === 'local-whisper' ? 'Local Whisper' : 'Local Parakeet'
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
      return `${getProviderLabel(providerId)} is currently supported on macOS only in this release.`
    }

    return RUNTIME_UNAVAILABLE_MESSAGE_BY_PROVIDER[providerId]
  }, [providerId, runtimeStatus])

  return {
    warning,
    runtimeError: shouldCheckRuntime ? runtimeStatusQuery.error : null
  }
}
