import type { TranscriptionProviderId } from './transcription'
import { LOCAL_MODELS } from './local-model-catalog'

export const LOCAL_PARAKEET_MODEL_ID = LOCAL_MODELS.parakeet.id

export type LocalTranscriptionProviderId = Extract<
  TranscriptionProviderId,
  'local-parakeet' | 'local-whisper' | 'local-qwen'
>

export type LocalTranscriptionModelId = string

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
  providerId: LocalTranscriptionProviderId
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

export type LocalProviderActionInput = {
  providerId: LocalTranscriptionProviderId
}

export type LocalModelActionInput = LocalProviderActionInput & {
  modelId: LocalTranscriptionModelId
}

export type LocalModelActionResponse = {
  ok: boolean
  message?: string
}

export type LocalRuntimeStatusResponse = {
  status: LocalRuntimeStatus
}
