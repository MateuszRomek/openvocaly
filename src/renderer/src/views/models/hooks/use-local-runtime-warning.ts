import { useMemo } from 'react'
import type { TranscriptionProviderId } from './use-transcription-provider-catalog'
import { supportsLocalRuntimeActions } from '../constants/local-provider-capabilities'
import { useLocalRuntimeStatusQuery } from '../queries/transcription/use-local-runtime-status-query'

type UseLocalRuntimeWarningResult = {
  warning: string | null
  runtimeError: unknown
}

export const useLocalRuntimeWarning = (
  providerId: TranscriptionProviderId
): UseLocalRuntimeWarningResult => {
  const runtimeStatusQuery = useLocalRuntimeStatusQuery(providerId)
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
      return 'Local Parakeet is currently supported on macOS only in this release.'
    }

    return 'Local runtime binary not found. It should be prepared automatically on npm run dev/build. If still missing, run npm run download:sherpa-onnx and restart app.'
  }, [providerId, runtimeStatus])

  return {
    warning,
    runtimeError: supportsLocalRuntimeActions(providerId) ? runtimeStatusQuery.error : null
  }
}
