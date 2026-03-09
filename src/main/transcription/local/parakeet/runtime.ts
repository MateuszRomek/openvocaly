import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  ListLocalModelsResponse,
  LocalModelActionInput,
  LocalModelActionResponse,
  LocalModelDownloadProgress,
  LocalRuntimeStatusResponse,
  LocalTranscriptionModelId
} from '../../../../shared/local-transcription'
import {
  convertFileToWav,
  getFfmpegPath,
  safeCleanupFiles,
  wavFileToFloat32Buffer
} from '../ffmpeg-utils'
import { LocalParakeetError } from './errors'
import { parakeetModelManager } from './model-manager'
import { ParakeetWsClient } from './ws-client'

const PARAKEET_SAMPLE_RATE = 16000

export class ParakeetRuntime {
  private readonly wsClient = new ParakeetWsClient()

  private isPlatformSupported(): boolean {
    return process.platform === 'darwin'
  }

  async listModels(): Promise<ListLocalModelsResponse> {
    const models = await parakeetModelManager.listModels()
    return { models }
  }

  isModelDownloaded(modelId: string): boolean {
    if (!parakeetModelManager.ensureSupportedModel(modelId)) {
      return false
    }
    return parakeetModelManager.isModelDownloaded(modelId)
  }

  async downloadModel(
    params: LocalModelActionInput,
    onProgress?: (progress: LocalModelDownloadProgress) => void
  ): Promise<LocalModelActionResponse> {
    if (!parakeetModelManager.ensureSupportedModel(params.modelId)) {
      return { ok: false, message: 'Unsupported local model.' }
    }

    try {
      await parakeetModelManager.downloadModel(params.modelId, onProgress)
      return { ok: true }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to download local Parakeet model.'
      return { ok: false, message }
    }
  }

  cancelDownload(): LocalModelActionResponse {
    const cancelled = parakeetModelManager.cancelDownload()
    return cancelled
      ? { ok: true, message: 'Download cancelled.' }
      : { ok: false, message: 'No cancellable download in progress.' }
  }

  async deleteModel(params: LocalModelActionInput): Promise<LocalModelActionResponse> {
    if (!parakeetModelManager.ensureSupportedModel(params.modelId)) {
      return { ok: false, message: 'Unsupported local model.' }
    }

    const deleted = await parakeetModelManager.deleteModel(params.modelId)
    if (deleted) {
      await this.wsClient.stop()
      return { ok: true }
    }

    return { ok: false, message: 'Model not found.' }
  }

  getRuntimeStatus(): LocalRuntimeStatusResponse {
    const status = this.wsClient.getStatus()
    const platformSupported = process.platform === 'darwin'
    return {
      status: {
        available: status.available,
        running: status.running,
        modelId: status.modelId,
        binaryPath: status.binaryPath,
        platformSupported
      }
    }
  }

  async startRuntime(params: LocalModelActionInput): Promise<LocalModelActionResponse> {
    if (!this.isPlatformSupported()) {
      return { ok: false, message: 'Local Parakeet is currently supported on macOS only.' }
    }

    if (!parakeetModelManager.ensureSupportedModel(params.modelId)) {
      return { ok: false, message: 'Unsupported local model.' }
    }

    if (!parakeetModelManager.isModelDownloaded(params.modelId)) {
      return { ok: false, message: 'Local model is not downloaded.' }
    }

    try {
      await this.wsClient.start(params.modelId)
      return { ok: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start local runtime.'
      return { ok: false, message }
    }
  }

  async stopRuntime(): Promise<LocalModelActionResponse> {
    await this.wsClient.stop()
    return { ok: true }
  }

  async transcribeArtifact(
    artifactPath: string,
    modelId: string
  ): Promise<{ text: string; language?: string }> {
    if (!this.isPlatformSupported()) {
      throw new LocalParakeetError(
        'local_runtime_unavailable',
        'Local Parakeet is currently supported on macOS only.'
      )
    }

    if (!parakeetModelManager.ensureSupportedModel(modelId)) {
      throw new LocalParakeetError('local_transcription_failed', 'Unsupported local model.')
    }

    if (!this.wsClient.isAvailable()) {
      throw new LocalParakeetError(
        'local_runtime_unavailable',
        'Local Parakeet runtime binary is unavailable.'
      )
    }

    if (!getFfmpegPath()) {
      throw new LocalParakeetError(
        'local_runtime_unavailable',
        'FFmpeg is unavailable. Install FFmpeg or reinstall the app.'
      )
    }

    if (!parakeetModelManager.isModelDownloaded(modelId)) {
      throw new LocalParakeetError(
        'local_model_not_downloaded',
        'Local Parakeet model is not downloaded.'
      )
    }

    const wavPath = join(tmpdir(), `openvocaly-parakeet-${randomUUID()}.wav`)

    try {
      await convertFileToWav(artifactPath, wavPath, {
        sampleRate: PARAKEET_SAMPLE_RATE,
        channels: 1
      })
      const float32Samples = await wavFileToFloat32Buffer(wavPath)
      await this.wsClient.start(modelId as LocalTranscriptionModelId)
      const text = await this.wsClient.transcribe(float32Samples, PARAKEET_SAMPLE_RATE)
      return { text, language: 'auto' }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Local Parakeet transcription failed.'
      throw new LocalParakeetError('local_transcription_failed', message)
    } finally {
      await safeCleanupFiles([wavPath])
    }
  }
}

export const parakeetRuntime = new ParakeetRuntime()
