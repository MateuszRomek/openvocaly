import { existsSync } from 'node:fs'
import { mkdir, readdir, rename, rm, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  LocalModelDownloadProgress,
  LocalModelInfo
} from '../../../../shared/local-transcription'
import { createArchiveExtractor } from '../archive-extractor'
import type { ArchiveExtractor } from '../archive-extractor'
import { getParakeetModelDir, getParakeetModelsRootDir } from '../model-dir-utils'
import { downloadFile } from '../model-download-client'
import {
  getParakeetModelDefinition,
  getParakeetModelIds,
  isSupportedParakeetModelId,
  PARAKEET_REQUIRED_MODEL_FILES,
  type ParakeetModelId
} from './model-catalog'

type DownloadState = {
  modelId: ParakeetModelId
  abortController: AbortController
}

type ParakeetModelManagerDeps = {
  archiveExtractor?: ArchiveExtractor
  progressByModel?: Map<ParakeetModelId, ParakeetModelDownloadProgress>
}

const PARAKEET_PROVIDER_ID = 'local-parakeet' as const

type ParakeetModelDownloadProgress = LocalModelDownloadProgress & {
  providerId: typeof PARAKEET_PROVIDER_ID
  modelId: ParakeetModelId
}

export class ParakeetModelManager {
  private activeDownload: DownloadState | null = null
  private readonly archiveExtractor: ArchiveExtractor
  private readonly progressByModel: Map<ParakeetModelId, ParakeetModelDownloadProgress>

  constructor(deps: ParakeetModelManagerDeps = {}) {
    this.archiveExtractor = deps.archiveExtractor ?? createArchiveExtractor()
    this.progressByModel = deps.progressByModel ?? new Map()
  }

  private toModelInfo(modelId: ParakeetModelId): LocalModelInfo {
    const model = getParakeetModelDefinition(modelId)
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

  isModelDownloaded(modelId: ParakeetModelId): boolean {
    const modelDir = getParakeetModelDir(modelId)
    if (!existsSync(modelDir)) {
      return false
    }

    return PARAKEET_REQUIRED_MODEL_FILES.every((fileName) => existsSync(join(modelDir, fileName)))
  }

  async listModels(): Promise<LocalModelInfo[]> {
    await mkdir(getParakeetModelsRootDir(), { recursive: true })
    return getParakeetModelIds().map((modelId) => this.toModelInfo(modelId))
  }

  private updateProgress(progress: ParakeetModelDownloadProgress): void {
    this.progressByModel.set(progress.modelId, progress)
  }

  private async extractModelArchive(archivePath: string, modelId: ParakeetModelId): Promise<void> {
    const model = getParakeetModelDefinition(modelId)
    const extractRoot = join(getParakeetModelsRootDir(), `tmp-extract-${modelId}-${Date.now()}`)
    await mkdir(extractRoot, { recursive: true })

    await this.archiveExtractor.extractTarBz2(archivePath, extractRoot)

    const expectedExtractedDir = join(extractRoot, model.extractDir)
    const targetModelDir = getParakeetModelDir(modelId)

    let sourceModelDir = expectedExtractedDir
    if (!existsSync(sourceModelDir)) {
      const entries = await readdir(extractRoot)
      const candidate = entries.find((entry) => entry.includes('parakeet'))
      if (!candidate) {
        throw new Error('Model archive does not contain expected model directory.')
      }
      sourceModelDir = join(extractRoot, candidate)
    }

    if (existsSync(targetModelDir)) {
      await rm(targetModelDir, { recursive: true, force: true })
    }

    await rename(sourceModelDir, targetModelDir)
    await rm(extractRoot, { recursive: true, force: true })

    const missing = PARAKEET_REQUIRED_MODEL_FILES.filter(
      (fileName) => !existsSync(join(targetModelDir, fileName))
    )
    if (missing.length > 0) {
      throw new Error(`Model validation failed. Missing files: ${missing.join(', ')}`)
    }
  }

  private async downloadArchive(
    modelId: ParakeetModelId,
    destinationPath: string,
    abortSignal: AbortSignal,
    onProgress: (downloadedBytes: number, totalBytes: number) => void
  ): Promise<void> {
    const model = getParakeetModelDefinition(modelId)
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

    throw new Error(`Model download failed for all sources. ${errors.join(' | ')}`)
  }

  async downloadModel(
    modelId: ParakeetModelId,
    onProgress?: (progress: LocalModelDownloadProgress) => void
  ): Promise<void> {
    if (this.isModelDownloaded(modelId)) {
      const progress = {
        providerId: PARAKEET_PROVIDER_ID,
        modelId,
        state: 'complete',
        downloadedBytes: 0,
        totalBytes: 0,
        percentage: 100
      } satisfies ParakeetModelDownloadProgress
      this.updateProgress(progress)
      onProgress?.(progress)
      return
    }

    if (this.activeDownload) {
      throw new Error('Another Parakeet model download is already in progress.')
    }

    const archivePath = join(tmpdir(), `openvocaly-${modelId}-${Date.now()}.tar.bz2`)
    await mkdir(getParakeetModelsRootDir(), { recursive: true })

    const abortController = new AbortController()
    this.activeDownload = { modelId, abortController }

    try {
      const downloading = {
        providerId: PARAKEET_PROVIDER_ID,
        modelId,
        state: 'downloading',
        downloadedBytes: 0,
        totalBytes: 0,
        percentage: 0
      } satisfies ParakeetModelDownloadProgress
      this.updateProgress(downloading)
      onProgress?.(downloading)

      await this.downloadArchive(
        modelId,
        archivePath,
        abortController.signal,
        (downloaded, total) => {
          const progress = {
            providerId: PARAKEET_PROVIDER_ID,
            modelId,
            state: 'downloading',
            downloadedBytes: downloaded,
            totalBytes: total,
            percentage: total > 0 ? Math.round((downloaded / total) * 100) : 0
          } satisfies ParakeetModelDownloadProgress
          this.updateProgress(progress)
          onProgress?.(progress)
        }
      )

      const installing = {
        providerId: PARAKEET_PROVIDER_ID,
        modelId,
        state: 'installing',
        downloadedBytes: 0,
        totalBytes: 0,
        percentage: 100
      } satisfies ParakeetModelDownloadProgress
      this.updateProgress(installing)
      onProgress?.(installing)

      await this.extractModelArchive(archivePath, modelId)

      const complete = {
        providerId: PARAKEET_PROVIDER_ID,
        modelId,
        state: 'complete',
        downloadedBytes: 0,
        totalBytes: 0,
        percentage: 100
      } satisfies ParakeetModelDownloadProgress
      this.updateProgress(complete)
      onProgress?.(complete)
    } catch (error) {
      const progress = {
        providerId: PARAKEET_PROVIDER_ID,
        modelId,
        state: 'error',
        downloadedBytes: 0,
        totalBytes: 0,
        percentage: 0,
        error: error instanceof Error ? error.message : 'Failed to download local model.'
      } satisfies ParakeetModelDownloadProgress
      this.updateProgress(progress)
      onProgress?.(progress)
      throw error
    } finally {
      this.activeDownload = null
      try {
        await unlink(archivePath)
      } catch {
        // Ignore cleanup failures.
      }
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

  async deleteModel(modelId: ParakeetModelId): Promise<boolean> {
    const modelDir = getParakeetModelDir(modelId)
    if (!existsSync(modelDir)) {
      return false
    }

    await rm(modelDir, { recursive: true, force: true })
    this.updateProgress({
      providerId: PARAKEET_PROVIDER_ID,
      modelId,
      state: 'idle',
      downloadedBytes: 0,
      totalBytes: 0,
      percentage: 0
    })
    return true
  }

  getAvailableModelIds(): ParakeetModelId[] {
    return getParakeetModelIds()
  }

  ensureSupportedModel(modelId: string): modelId is ParakeetModelId {
    return isSupportedParakeetModelId(modelId)
  }
}

export const parakeetModelManager = new ParakeetModelManager()
