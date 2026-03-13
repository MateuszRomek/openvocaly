import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { convertFileToWav, getFfmpegPath, safeCleanupFiles } from '../ffmpeg-utils'
import { LocalWhisperError } from './errors'
import type { WhisperModelDownloadProgress, WhisperModelInfo } from './model-manager'
import { whisperModelManager } from './model-manager'
import { WhisperServerClient } from './server-client'
import { type WhisperModelId } from './model-catalog'

const WHISPER_SAMPLE_RATE = 16000

type WhisperModelActionInput = {
  modelId: WhisperModelId
}

type WhisperModelActionResponse = {
  ok: boolean
  message?: string
}

type WhisperListModelsResponse = {
  models: WhisperModelInfo[]
}

type WhisperRuntimeStatusResponse = {
  status: {
    available: boolean
    running: boolean
    modelId: WhisperModelId | null
    binaryPath: string | null
    platformSupported: boolean
  }
}

export class WhisperRuntime {
  private readonly serverClient = new WhisperServerClient()

  private isPlatformSupported(): boolean {
    return process.platform === 'darwin'
  }

  async listModels(): Promise<WhisperListModelsResponse> {
    const models = await whisperModelManager.listModels()
    return { models }
  }

  isModelDownloaded(modelId: string): boolean {
    if (!whisperModelManager.ensureSupportedModel(modelId)) {
      return false
    }

    return whisperModelManager.isModelDownloaded(modelId)
  }

  async downloadModel(
    params: WhisperModelActionInput,
    onProgress?: (progress: WhisperModelDownloadProgress) => void
  ): Promise<WhisperModelActionResponse> {
    if (!whisperModelManager.ensureSupportedModel(params.modelId)) {
      return { ok: false, message: 'Unsupported local model.' }
    }

    try {
      await whisperModelManager.downloadModel(params.modelId, onProgress)
      return { ok: true }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to download local Whisper model.'
      return { ok: false, message }
    }
  }

  cancelDownload(): WhisperModelActionResponse {
    const cancelled = whisperModelManager.cancelDownload()
    return cancelled
      ? { ok: true, message: 'Download cancelled.' }
      : { ok: false, message: 'No cancellable download in progress.' }
  }

  async deleteModel(params: WhisperModelActionInput): Promise<WhisperModelActionResponse> {
    if (!whisperModelManager.ensureSupportedModel(params.modelId)) {
      return { ok: false, message: 'Unsupported local model.' }
    }

    const deleted = await whisperModelManager.deleteModel(params.modelId)
    if (deleted) {
      await this.serverClient.stop()
      return { ok: true }
    }

    return { ok: false, message: 'Model not found.' }
  }

  getRuntimeStatus(): WhisperRuntimeStatusResponse {
    const status = this.serverClient.getStatus()

    return {
      status: {
        available: status.available,
        running: status.running,
        modelId: status.modelId,
        binaryPath: status.binaryPath,
        platformSupported: this.isPlatformSupported()
      }
    }
  }

  async startRuntime(params: WhisperModelActionInput): Promise<WhisperModelActionResponse> {
    if (!this.isPlatformSupported()) {
      return { ok: false, message: 'Local Whisper is currently supported on macOS only.' }
    }

    if (!whisperModelManager.ensureSupportedModel(params.modelId)) {
      return { ok: false, message: 'Unsupported local model.' }
    }

    if (!whisperModelManager.isModelDownloaded(params.modelId)) {
      return { ok: false, message: 'Local model is not downloaded.' }
    }

    try {
      await this.serverClient.start(params.modelId)
      return { ok: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start local runtime.'
      return { ok: false, message }
    }
  }

  async stopRuntime(): Promise<WhisperModelActionResponse> {
    await this.serverClient.stop()
    return { ok: true }
  }

  async transcribeArtifact(
    artifactPath: string,
    modelId: string
  ): Promise<{ text: string; language?: string }> {
    if (!this.isPlatformSupported()) {
      throw new LocalWhisperError(
        'local_runtime_unavailable',
        'Local Whisper is currently supported on macOS only.'
      )
    }

    if (!whisperModelManager.ensureSupportedModel(modelId)) {
      throw new LocalWhisperError('local_transcription_failed', 'Unsupported local model.')
    }

    if (!this.serverClient.isAvailable()) {
      throw new LocalWhisperError(
        'local_runtime_unavailable',
        'Local Whisper runtime binary is unavailable.'
      )
    }

    if (!getFfmpegPath()) {
      throw new LocalWhisperError(
        'local_runtime_unavailable',
        'FFmpeg is unavailable. Install FFmpeg or reinstall the app.'
      )
    }

    if (!whisperModelManager.isModelDownloaded(modelId)) {
      throw new LocalWhisperError(
        'local_model_not_downloaded',
        'Local Whisper model is not downloaded.'
      )
    }

    const wavPath = join(tmpdir(), `openvocaly-whisper-${randomUUID()}.wav`)

    try {
      await convertFileToWav(artifactPath, wavPath, {
        sampleRate: WHISPER_SAMPLE_RATE,
        channels: 1
      })

      const wavBuffer = await readFile(wavPath)
      await this.serverClient.start(modelId)
      const text = await this.serverClient.transcribe(wavBuffer)
      return { text, language: 'auto' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Local Whisper transcription failed.'
      throw new LocalWhisperError('local_transcription_failed', message)
    } finally {
      await safeCleanupFiles([wavPath])
    }
  }
}

export const whisperRuntime = new WhisperRuntime()
