import { existsSync, statSync } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { getWhisperModelFilePath, getWhisperModelsRootDir } from '../model-dir-utils'
import { downloadFile } from '../model-download-client'
import {
  getWhisperModelDefinition,
  getWhisperModelIds,
  isSupportedWhisperModelId,
  type WhisperModelId
} from './model-catalog'

type WhisperModelDownloadState = 'idle' | 'downloading' | 'installing' | 'complete' | 'error'

export type WhisperModelInfo = {
  id: WhisperModelId
  label: string
  description: string
  language: string
  sizeMb: number
  downloaded: boolean
  downloadState: WhisperModelDownloadState
}

export type WhisperModelDownloadProgress = {
  providerId: 'local-whisper'
  modelId: WhisperModelId
  state: WhisperModelDownloadState
  downloadedBytes: number
  totalBytes: number
  percentage: number
  error?: string
}

type DownloadState = {
  modelId: WhisperModelId
  abortController: AbortController
}

const WHISPER_PROVIDER_ID = 'local-whisper' as const

export class WhisperModelManager {
  private activeDownload: DownloadState | null = null
  private readonly progressByModel = new Map<WhisperModelId, WhisperModelDownloadProgress>()

  private toModelInfo(modelId: WhisperModelId): WhisperModelInfo {
    const model = getWhisperModelDefinition(modelId)
    const downloaded = this.isModelDownloaded(modelId)
    const progress = this.progressByModel.get(modelId)

    return {
      id: modelId,
      label: model.label,
      description: model.description,
      language: model.language,
      sizeMb: model.sizeMb,
      downloaded,
      downloadState: progress?.state ?? (downloaded ? 'complete' : 'idle')
    }
  }

  private isModelFileValid(modelId: WhisperModelId): boolean {
    const model = getWhisperModelDefinition(modelId)
    const modelPath = getWhisperModelFilePath(modelId)

    if (!existsSync(modelPath)) {
      return false
    }

    try {
      const stats = statSync(modelPath)
      return stats.size >= model.minimumSizeBytes
    } catch {
      return false
    }
  }

  isModelDownloaded(modelId: WhisperModelId): boolean {
    return this.isModelFileValid(modelId)
  }

  async listModels(): Promise<WhisperModelInfo[]> {
    await mkdir(getWhisperModelsRootDir(), { recursive: true })
    return getWhisperModelIds().map((modelId) => this.toModelInfo(modelId))
  }

  private updateProgress(progress: WhisperModelDownloadProgress): void {
    this.progressByModel.set(progress.modelId, progress)
  }

  private async downloadModelFile(
    modelId: WhisperModelId,
    destinationPath: string,
    abortSignal: AbortSignal,
    onProgress: (downloadedBytes: number, totalBytes: number) => void
  ): Promise<void> {
    const model = getWhisperModelDefinition(modelId)
    const errors: string[] = []

    for (const sourceUrl of model.downloadSources) {
      try {
        await downloadFile(sourceUrl, destinationPath, {
          signal: abortSignal,
          onProgress
        })
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown download error.'
        errors.push(`${sourceUrl}: ${message}`)
      }
    }

    throw new Error(`Whisper model download failed for all sources. ${errors.join(' | ')}`)
  }

  async downloadModel(
    modelId: WhisperModelId,
    onProgress?: (progress: WhisperModelDownloadProgress) => void
  ): Promise<void> {
    if (this.isModelDownloaded(modelId)) {
      const complete = {
        providerId: WHISPER_PROVIDER_ID,
        modelId,
        state: 'complete',
        downloadedBytes: 0,
        totalBytes: 0,
        percentage: 100
      } satisfies WhisperModelDownloadProgress
      this.updateProgress(complete)
      onProgress?.(complete)
      return
    }

    if (this.activeDownload) {
      throw new Error('Another Whisper model download is already in progress.')
    }

    await mkdir(getWhisperModelsRootDir(), { recursive: true })

    const modelPath = getWhisperModelFilePath(modelId)
    const tempPath = join(getWhisperModelsRootDir(), `${modelId}-${Date.now()}.download`)
    const abortController = new AbortController()
    this.activeDownload = { modelId, abortController }

    try {
      const downloading = {
        providerId: WHISPER_PROVIDER_ID,
        modelId,
        state: 'downloading',
        downloadedBytes: 0,
        totalBytes: 0,
        percentage: 0
      } satisfies WhisperModelDownloadProgress
      this.updateProgress(downloading)
      onProgress?.(downloading)

      await this.downloadModelFile(
        modelId,
        tempPath,
        abortController.signal,
        (downloaded, total) => {
          const progress = {
            providerId: WHISPER_PROVIDER_ID,
            modelId,
            state: 'downloading',
            downloadedBytes: downloaded,
            totalBytes: total,
            percentage: total > 0 ? Math.round((downloaded / total) * 100) : 0
          } satisfies WhisperModelDownloadProgress
          this.updateProgress(progress)
          onProgress?.(progress)
        }
      )

      const installing = {
        providerId: WHISPER_PROVIDER_ID,
        modelId,
        state: 'installing',
        downloadedBytes: 0,
        totalBytes: 0,
        percentage: 100
      } satisfies WhisperModelDownloadProgress
      this.updateProgress(installing)
      onProgress?.(installing)

      if (existsSync(modelPath)) {
        await rm(modelPath, { force: true })
      }
      await rename(tempPath, modelPath)

      if (!this.isModelFileValid(modelId)) {
        throw new Error('Downloaded Whisper model failed validation checks.')
      }

      const complete = {
        providerId: WHISPER_PROVIDER_ID,
        modelId,
        state: 'complete',
        downloadedBytes: 0,
        totalBytes: 0,
        percentage: 100
      } satisfies WhisperModelDownloadProgress
      this.updateProgress(complete)
      onProgress?.(complete)
    } catch (error) {
      const progress = {
        providerId: WHISPER_PROVIDER_ID,
        modelId,
        state: 'error',
        downloadedBytes: 0,
        totalBytes: 0,
        percentage: 0,
        error: error instanceof Error ? error.message : 'Failed to download local Whisper model.'
      } satisfies WhisperModelDownloadProgress
      this.updateProgress(progress)
      onProgress?.(progress)
      throw error
    } finally {
      this.activeDownload = null
      await rm(tempPath, { force: true }).catch(() => {
        // Ignore cleanup failures.
      })
    }
  }

  cancelDownload(): boolean {
    if (!this.activeDownload) {
      return false
    }

    const progress = this.progressByModel.get(this.activeDownload.modelId)
    if (progress?.state !== 'downloading') {
      return false
    }

    this.activeDownload.abortController.abort()
    return true
  }

  async deleteModel(modelId: WhisperModelId): Promise<boolean> {
    const modelPath = getWhisperModelFilePath(modelId)
    if (!existsSync(modelPath)) {
      return false
    }

    await rm(modelPath, { force: true })
    this.updateProgress({
      providerId: WHISPER_PROVIDER_ID,
      modelId,
      state: 'idle',
      downloadedBytes: 0,
      totalBytes: 0,
      percentage: 0
    })
    return true
  }

  getAvailableModelIds(): WhisperModelId[] {
    return getWhisperModelIds()
  }

  ensureSupportedModel(modelId: string): modelId is WhisperModelId {
    return isSupportedWhisperModelId(modelId)
  }
}

export const whisperModelManager = new WhisperModelManager()
