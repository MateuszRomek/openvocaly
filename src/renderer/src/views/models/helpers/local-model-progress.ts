type DownloadProgressLike = {
  state: 'idle' | 'downloading' | 'installing' | 'complete' | 'error'
  percentage: number
  error?: string
}

export const getLocalModelDownloadProgressLabel = (
  progress: DownloadProgressLike | null
): string => {
  if (!progress) {
    return ''
  }

  if (progress.state === 'installing') {
    return 'Installing...'
  }

  if (progress.state === 'downloading') {
    return `Downloading ${progress.percentage}%`
  }

  if (progress.state === 'error') {
    return progress.error ?? 'Download failed.'
  }

  return ''
}
