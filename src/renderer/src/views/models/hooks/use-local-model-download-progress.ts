import { useEffect, useState } from 'react'
import type { LocalModelDownloadProgress } from '../types/local-models'

const isTerminalProgressState = (state: LocalModelDownloadProgress['state']): boolean => {
  return state === 'complete' || state === 'error' || state === 'idle'
}

type UseLocalModelDownloadProgressResult = {
  // Tracks which provider/model currently emits download/install progress events.
  activeDownload: {
    providerId: LocalModelDownloadProgress['providerId']
    modelId: LocalModelDownloadProgress['modelId']
  } | null
  downloadProgress: LocalModelDownloadProgress | null
}

export function useLocalModelDownloadProgress(): UseLocalModelDownloadProgressResult {
  const [activeDownload, setActiveDownload] =
    useState<UseLocalModelDownloadProgressResult['activeDownload']>(null)
  const [downloadProgress, setDownloadProgress] = useState<LocalModelDownloadProgress | null>(null)

  useEffect(() => {
    return window.api.transcription.local.onDownloadProgress((progress) => {
      setDownloadProgress(progress)

      if (isTerminalProgressState(progress.state)) {
        setActiveDownload(null)
        return
      }

      setActiveDownload({
        providerId: progress.providerId,
        modelId: progress.modelId
      })
    })
  }, [])

  return { activeDownload, downloadProgress }
}
