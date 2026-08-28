import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LOCAL_MODELS } from '../../../../shared/local-model-catalog'
import type {
  ListLocalModelsResponse,
  LocalModelActionResponse,
  LocalModelDownloadProgress,
  LocalModelInfo,
  LocalRuntimeStatusResponse
} from '../../../../shared/local-transcription'
import type { TranscriptionDiagnostics } from '../../../../shared/transcription'
import { convertFileToWav, getFfmpegPath, safeCleanupPaths } from '../ffmpeg-utils'
import { LocalParakeetError } from '../parakeet/errors'
import { getParakeetModelDir, getParakeetModelsRootDir } from '../model-dir-utils'
import { MacOSAsrHostClient } from './client'
import { isMacOSParakeetSupported } from './runtime-discovery'

const PARAKEET_MODEL_ID = LOCAL_MODELS.parakeet.id
const PARAKEET_REPOSITORY_DIRECTORY = 'parakeet-tdt-0.6b-v3'
const PARAKEET_REQUIRED_FILES = [
  'Preprocessor.mlmodelc',
  'Encoder.mlmodelc',
  'Decoder.mlmodelc',
  'JointDecisionv3.mlmodelc',
  'parakeet_vocab.json'
] as const

/** The macOS-only Parakeet adapter. It owns no Electron or UI concerns. */
export class MacOSParakeetRuntime {
  private readonly host = new MacOSAsrHostClient()
  private downloadState: LocalModelDownloadProgress['state'] = 'idle'
  private downloadError: string | undefined
  private activeDownload: { cancelled: boolean; onProgress?: ProgressCallback } | null = null

  async listModels(): Promise<ListLocalModelsResponse> {
    await mkdir(getParakeetModelsRootDir(), { recursive: true })
    return { models: [this.toModelInfo()] }
  }

  isModelDownloaded(modelId: string): boolean {
    if (modelId !== PARAKEET_MODEL_ID) {
      return false
    }

    const repositoryDirectory = join(getParakeetModelDir(modelId), PARAKEET_REPOSITORY_DIRECTORY)
    return PARAKEET_REQUIRED_FILES.every((fileName) =>
      existsSync(join(repositoryDirectory, fileName))
    )
  }

  async downloadModel(
    modelId: string,
    onProgress?: (progress: LocalModelDownloadProgress) => void
  ): Promise<LocalModelActionResponse> {
    if (modelId !== PARAKEET_MODEL_ID) {
      return { ok: false, message: 'Unsupported local model.' }
    }
    if (!this.host.isAvailable()) {
      return { ok: false, message: 'The macOS Parakeet host is unavailable. Reinstall the app.' }
    }
    if (this.activeDownload) {
      return { ok: false, message: 'Parakeet is already downloading.' }
    }

    const download = { cancelled: false, onProgress }
    this.activeDownload = download
    this.updateProgress('downloading', onProgress)
    try {
      await this.host.install(getParakeetModelDir(modelId), (percentage) => {
        if (this.activeDownload !== download || download.cancelled) {
          return
        }
        this.updateProgress('downloading', onProgress, percentage)
      })
      if (download.cancelled) {
        this.updateProgress('idle', onProgress)
        return { ok: true, message: 'Parakeet download cancelled.' }
      }
      if (!this.isModelDownloaded(modelId)) {
        throw new Error('The installed Parakeet model did not pass validation.')
      }
      this.updateProgress('complete', onProgress)
      return { ok: true }
    } catch (error) {
      if (download.cancelled) {
        this.updateProgress('idle', onProgress)
        return { ok: true, message: 'Parakeet download cancelled.' }
      }
      const message = error instanceof Error ? error.message : 'Failed to install Parakeet.'
      this.downloadError = message
      this.updateProgress('error', onProgress)
      return { ok: false, message }
    } finally {
      if (this.activeDownload === download) {
        this.activeDownload = null
      }
    }
  }

  cancelDownload(): LocalModelActionResponse {
    if (!this.activeDownload) {
      return { ok: false, message: 'No cancellable Parakeet download is in progress.' }
    }

    this.activeDownload.cancelled = true
    this.updateProgress('idle', this.activeDownload.onProgress)
    void this.host.stop()
    return { ok: true, message: 'Parakeet download cancelled.' }
  }

  async deleteModel(modelId: string): Promise<LocalModelActionResponse> {
    if (modelId !== PARAKEET_MODEL_ID) {
      return { ok: false, message: 'Unsupported local model.' }
    }

    const modelDirectory = getParakeetModelDir(modelId)
    if (!existsSync(modelDirectory)) {
      return { ok: false, message: 'Model not found.' }
    }

    await this.host.stop()
    await rm(modelDirectory, { recursive: true, force: true })
    this.downloadState = 'idle'
    this.downloadError = undefined
    return { ok: true }
  }

  getRuntimeStatus(): LocalRuntimeStatusResponse {
    return {
      status: {
        available: this.host.isAvailable(),
        running: this.host.isRunning(),
        modelId: this.host.isRunning() ? PARAKEET_MODEL_ID : null,
        binaryPath: null,
        platformSupported: isMacOSParakeetSupported()
      }
    }
  }

  async startRuntime(modelId: string): Promise<LocalModelActionResponse> {
    if (modelId !== PARAKEET_MODEL_ID) {
      return { ok: false, message: 'Unsupported local model.' }
    }
    if (!this.isModelDownloaded(modelId)) {
      return { ok: false, message: 'Local model is not downloaded.' }
    }

    try {
      await this.host.warm(getParakeetModelDir(modelId))
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to warm Parakeet.'
      }
    }
  }

  async stopRuntime(): Promise<LocalModelActionResponse> {
    await this.host.stop()
    return { ok: true }
  }

  async transcribeArtifact(
    artifactPath: string,
    modelId: string,
    signal?: AbortSignal
  ): Promise<{ text: string; language: string; diagnostics: TranscriptionDiagnostics }> {
    if (modelId !== PARAKEET_MODEL_ID) {
      throw new LocalParakeetError('local_transcription_failed', 'Unsupported local model.')
    }
    if (!this.host.isAvailable()) {
      throw new LocalParakeetError(
        'local_runtime_unavailable',
        'The macOS Parakeet host is unavailable. Reinstall the app.'
      )
    }
    if (!this.isModelDownloaded(modelId)) {
      throw new LocalParakeetError('local_model_not_downloaded', 'Local model is not downloaded.')
    }
    if (!getFfmpegPath()) {
      throw new LocalParakeetError(
        'local_runtime_unavailable',
        'FFmpeg is unavailable. Reinstall the app.'
      )
    }

    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'openvocaly-parakeet-'))
    const wavPath = join(temporaryDirectory, 'audio.wav')
    const startedAt = Date.now()
    try {
      await convertFileToWav(artifactPath, wavPath, {
        sampleRate: 16000,
        channels: 1,
        signal
      })
      const result = await this.host.transcribe(getParakeetModelDir(modelId), wavPath, signal)
      return {
        text: result.text,
        language: 'auto',
        diagnostics: {
          providerId: 'local-parakeet',
          modelId,
          durationMs: result.durationMs,
          chunkCount: 1,
          resultType: result.text ? 'success_full' : 'failed_empty',
          chunks: [
            {
              chunkIndex: 1,
              chunkCount: 1,
              attempt: 1,
              restarted: false,
              resultType: result.text ? 'success_full' : 'failed_empty',
              elapsedMs: Date.now() - startedAt
            }
          ]
        }
      }
    } catch (error) {
      throw new LocalParakeetError(
        'local_transcription_failed',
        error instanceof Error ? error.message : 'Local Parakeet transcription failed.'
      )
    } finally {
      await safeCleanupPaths([temporaryDirectory])
    }
  }

  private toModelInfo(): LocalModelInfo {
    const downloaded = this.isModelDownloaded(PARAKEET_MODEL_ID)
    return {
      id: PARAKEET_MODEL_ID,
      label: LOCAL_MODELS.parakeet.label,
      description: LOCAL_MODELS.parakeet.description,
      language: LOCAL_MODELS.parakeet.language,
      sizeMb: LOCAL_MODELS.parakeet.sizeMb,
      downloaded,
      downloadState: this.activeDownload
        ? this.downloadState
        : downloaded
          ? 'complete'
          : this.downloadState
    }
  }

  private updateProgress(
    state: LocalModelDownloadProgress['state'],
    onProgress?: ProgressCallback,
    percentage = state === 'complete' ? 100 : 0
  ): void {
    this.downloadState = state
    if (state !== 'error') {
      this.downloadError = undefined
    }
    onProgress?.({
      providerId: 'local-parakeet',
      modelId: PARAKEET_MODEL_ID,
      state,
      downloadedBytes: 0,
      totalBytes: 0,
      percentage,
      error: this.downloadError
    })
  }
}

type ProgressCallback = (progress: LocalModelDownloadProgress) => void

export const macOSParakeetRuntime = new MacOSParakeetRuntime()
