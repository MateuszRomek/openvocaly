export const LOCAL_PARAKEET_MODEL_ID = 'parakeet-tdt-0.6b-v3' as const

export type LocalTranscriptionModelId = typeof LOCAL_PARAKEET_MODEL_ID

export type LocalModelDownloadState = 'idle' | 'downloading' | 'installing' | 'complete' | 'error'

export type LocalModelInfo = {
  id: LocalTranscriptionModelId
  label: string
  description: string
  language: string
  sizeMb: number
  downloaded: boolean
  downloadState: LocalModelDownloadState
}

export type LocalModelDownloadProgress = {
  modelId: LocalTranscriptionModelId
  state: LocalModelDownloadState
  downloadedBytes: number
  totalBytes: number
  percentage: number
  error?: string
}

export type LocalRuntimeStatus = {
  available: boolean
  running: boolean
  modelId: LocalTranscriptionModelId | null
  binaryPath: string | null
  platformSupported: boolean
}

export type ListLocalModelsResponse = {
  models: LocalModelInfo[]
}

export type LocalModelActionInput = {
  modelId: LocalTranscriptionModelId
}

export type LocalModelActionResponse = {
  ok: boolean
  message?: string
}

export type LocalRuntimeStatusResponse = {
  status: LocalRuntimeStatus
}
