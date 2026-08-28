import { createHash } from 'node:crypto'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  LocalModelDownloadProgress,
  LocalModelInfo
} from '../../../../shared/local-transcription'
import { getQwenModelDir, getQwenModelsRootDir } from '../model-dir-utils'
import { downloadFile } from '../model-download-client'
import {
  getQwenModelDefinition,
  getQwenModelDownloadUrl,
  getQwenModelIds,
  isSupportedQwenModelId,
  type QwenModelId
} from './model-catalog'
import {
  downloadFileInParallelRanges,
  RangeRequestsUnsupportedError
} from './parallel-range-download'

type DownloadState = {
  modelId: QwenModelId
  abortController: AbortController
}

const QWEN_PROVIDER_ID = 'local-qwen' as const

const hashFile = async (filePath: string): Promise<string> =>
  await new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.once('error', reject)
    stream.once('end', () => resolve(hash.digest('hex')))
  })

/**
 * Owns Qwen model installation as an app-controlled, atomic transaction. The
 * MLX host only receives a validated local directory, so inference cannot
 * unexpectedly download or update model files.
 */
export class QwenModelManager {
  private activeDownload: DownloadState | null = null
  private readonly progressByModel = new Map<QwenModelId, LocalModelDownloadProgress>()

  private async isModelDirectoryValid(modelId: QwenModelId): Promise<boolean> {
    const definition = getQwenModelDefinition(modelId)
    const directory = getQwenModelDir(modelId)

    for (const file of definition.files) {
      const filePath = join(directory, file.name)
      if (!existsSync(filePath)) {
        return false
      }
      try {
        if (statSync(filePath).size !== file.sizeBytes) {
          return false
        }
        if (file.sha256 && (await hashFile(filePath)) !== file.sha256) {
          return false
        }
      } catch {
        return false
      }
    }

    return true
  }

  isModelDownloaded(modelId: QwenModelId): boolean {
    const definition = getQwenModelDefinition(modelId)
    const directory = getQwenModelDir(modelId)
    return definition.files.every((file) => {
      const filePath = join(directory, file.name)
      try {
        return existsSync(filePath) && statSync(filePath).size === file.sizeBytes
      } catch {
        return false
      }
    })
  }

  async listModels(): Promise<LocalModelInfo[]> {
    await mkdir(getQwenModelsRootDir(), { recursive: true })
    return getQwenModelIds().map((modelId) => this.toModelInfo(modelId))
  }

  private toModelInfo(modelId: QwenModelId): LocalModelInfo {
    const model = getQwenModelDefinition(modelId)
    const downloaded = this.isModelDownloaded(modelId)
    const progress = this.progressByModel.get(modelId)
    return {
      id: model.id,
      label: model.label,
      description: model.description,
      language: model.language,
      sizeMb: model.sizeMb,
      downloaded,
      downloadState: progress?.state ?? (downloaded ? 'complete' : 'idle')
    }
  }

  private emitProgress(
    modelId: QwenModelId,
    state: LocalModelDownloadProgress['state'],
    downloadedBytes: number,
    totalBytes: number,
    onProgress?: (progress: LocalModelDownloadProgress) => void,
    error?: string
  ): void {
    const progress: LocalModelDownloadProgress = {
      providerId: QWEN_PROVIDER_ID,
      modelId,
      state,
      downloadedBytes,
      totalBytes,
      percentage: totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0,
      error
    }
    this.progressByModel.set(modelId, progress)
    onProgress?.(progress)
  }

  async downloadModel(
    modelId: QwenModelId,
    onProgress?: (progress: LocalModelDownloadProgress) => void
  ): Promise<void> {
    if (await this.isModelDirectoryValid(modelId)) {
      this.emitProgress(modelId, 'complete', 1, 1, onProgress)
      return
    }
    if (this.activeDownload) {
      throw new Error('Another Qwen model download is already in progress.')
    }

    const definition = getQwenModelDefinition(modelId)
    const totalBytes = definition.files.reduce((total, file) => total + file.sizeBytes, 0)
    const destinationDirectory = getQwenModelDir(modelId)
    const temporaryDirectory = join(
      getQwenModelsRootDir(),
      `.${modelId}-${Date.now()}-${Math.random().toString(16).slice(2)}.download`
    )
    const abortController = new AbortController()
    this.activeDownload = { modelId, abortController }
    let completedBytes = 0

    try {
      await mkdir(temporaryDirectory, { recursive: true })
      this.emitProgress(modelId, 'downloading', 0, totalBytes, onProgress)

      for (const file of definition.files) {
        const destinationPath = join(temporaryDirectory, file.name)
        const sourceUrl = getQwenModelDownloadUrl(definition, file.name)
        const reportFileProgress = (downloadedBytes: number): void => {
          this.emitProgress(
            modelId,
            'downloading',
            completedBytes + downloadedBytes,
            totalBytes,
            onProgress
          )
        }

        if (file.name === 'model.safetensors') {
          try {
            await downloadFileInParallelRanges(sourceUrl, destinationPath, {
              signal: abortController.signal,
              totalBytes: file.sizeBytes,
              onProgress: reportFileProgress
            })
          } catch (error) {
            if (!(error instanceof RangeRequestsUnsupportedError)) {
              throw error
            }
            await downloadFile(sourceUrl, destinationPath, {
              signal: abortController.signal,
              onProgress: reportFileProgress
            })
          }
        } else {
          await downloadFile(sourceUrl, destinationPath, {
            signal: abortController.signal,
            onProgress: reportFileProgress
          })
        }
        if (statSync(destinationPath).size !== file.sizeBytes) {
          throw new Error(`Downloaded ${file.name} has an unexpected size.`)
        }
        if (file.sha256 && (await hashFile(destinationPath)) !== file.sha256) {
          throw new Error(`Downloaded ${file.name} failed its checksum validation.`)
        }
        completedBytes += file.sizeBytes
      }

      this.emitProgress(modelId, 'installing', completedBytes, totalBytes, onProgress)
      if (existsSync(destinationDirectory)) {
        await rm(destinationDirectory, { recursive: true, force: true })
      }
      await rename(temporaryDirectory, destinationDirectory)
      if (!(await this.isModelDirectoryValid(modelId))) {
        throw new Error('Downloaded Qwen model failed validation checks.')
      }
      this.emitProgress(modelId, 'complete', totalBytes, totalBytes, onProgress)
    } catch (error) {
      if (abortController.signal.aborted) {
        this.emitProgress(modelId, 'idle', 0, totalBytes, onProgress)
        return
      }
      const message =
        error instanceof Error ? error.message : 'Failed to download local Qwen model.'
      this.emitProgress(modelId, 'error', completedBytes, totalBytes, onProgress, message)
      throw error
    } finally {
      if (this.activeDownload?.abortController === abortController) {
        this.activeDownload = null
      }
      await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined)
    }
  }

  cancelDownload(): boolean {
    if (!this.activeDownload) {
      return false
    }
    this.activeDownload.abortController.abort()
    return true
  }

  async deleteModel(modelId: QwenModelId): Promise<boolean> {
    const directory = getQwenModelDir(modelId)
    if (!existsSync(directory)) {
      return false
    }
    await rm(directory, { recursive: true, force: true })
    this.emitProgress(modelId, 'idle', 0, 0)
    return true
  }

  ensureSupportedModel(modelId: string): modelId is QwenModelId {
    return isSupportedQwenModelId(modelId)
  }
}

export const qwenModelManager = new QwenModelManager()
