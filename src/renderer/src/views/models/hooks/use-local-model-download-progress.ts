import { useEffect, useState } from 'react'
import type { LocalModelDownloadProgress } from '../types/local-models'

const isTerminalProgressState = (state: LocalModelDownloadProgress['state']): boolean => {
  return state === 'complete' || state === 'error' || state === 'idle'
}

type UseLocalModelDownloadProgressResult = {
  // Tracks which model currently emits download/install progress events.
  activeDownloadModelId: string | null
  downloadProgress: LocalModelDownloadProgress | null
}

export function useLocalModelDownloadProgress(): UseLocalModelDownloadProgressResult {
  const [activeDownloadModelId, setActiveDownloadModelId] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<LocalModelDownloadProgress | null>(null)

  useEffect(() => {
    return window.api.transcription.local.onDownloadProgress((progress) => {
      setDownloadProgress(progress)

      if (isTerminalProgressState(progress.state)) {
        setActiveDownloadModelId(null)
        return
      }

      setActiveDownloadModelId(progress.modelId)
    })
  }, [])

  return { activeDownloadModelId, downloadProgress }
}
