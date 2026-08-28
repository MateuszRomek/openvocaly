import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  ListLocalModelsResponse,
  LocalModelActionResponse,
  LocalModelDownloadProgress,
  LocalRuntimeStatusResponse
} from '../../../../shared/local-transcription'
import type { TranscriptionDiagnostics } from '../../../../shared/transcription'
import { convertFileToWav, getFfmpegPath, safeCleanupPaths } from '../ffmpeg-utils'
import { getQwenModelDir } from '../model-dir-utils'
import { QwenMlxHostClient } from '../qwen-mlx-host/client'
import { isQwenMlxSupported } from '../qwen-mlx-host/runtime-discovery'
import { LocalQwenError } from './errors'
import { qwenModelManager } from './model-manager'
import type { QwenModelId } from './model-catalog'

const QWEN_SAMPLE_RATE = 16000

export type QwenTranscriptionRuntimeResult = {
  text: string
  language?: string
  diagnostics: TranscriptionDiagnostics
}

/** macOS adapter for app-owned Qwen MLX model directories and the bundled host. */
export class QwenRuntime {
  private readonly host = new QwenMlxHostClient()

  async listModels(): Promise<ListLocalModelsResponse> {
    return { models: await qwenModelManager.listModels() }
  }

  isModelDownloaded(modelId: string): boolean {
    return (
      qwenModelManager.ensureSupportedModel(modelId) && qwenModelManager.isModelDownloaded(modelId)
    )
  }

  async downloadModel(
    modelId: string,
    onProgress?: (progress: LocalModelDownloadProgress) => void
  ): Promise<LocalModelActionResponse> {
    if (!qwenModelManager.ensureSupportedModel(modelId)) {
      return { ok: false, message: 'Unsupported local model.' }
    }
    try {
      await qwenModelManager.downloadModel(modelId, onProgress)
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to download local Qwen model.'
      }
    }
  }

  cancelDownload(): LocalModelActionResponse {
    return qwenModelManager.cancelDownload()
      ? { ok: true, message: 'Download cancelled.' }
      : { ok: false, message: 'No cancellable download in progress.' }
  }

  async deleteModel(modelId: string): Promise<LocalModelActionResponse> {
    if (!qwenModelManager.ensureSupportedModel(modelId)) {
      return { ok: false, message: 'Unsupported local model.' }
    }
    await this.host.stop()
    return (await qwenModelManager.deleteModel(modelId))
      ? { ok: true }
      : { ok: false, message: 'Model not found.' }
  }

  getRuntimeStatus(): LocalRuntimeStatusResponse {
    return {
      status: {
        available: this.host.isAvailable(),
        running: this.host.isRunning(),
        modelId: null,
        binaryPath: null,
        platformSupported: isQwenMlxSupported()
      }
    }
  }

  async startRuntime(modelId: string): Promise<LocalModelActionResponse> {
    if (!isQwenMlxSupported()) {
      return {
        ok: false,
        message: 'Local Qwen currently requires Apple Silicon and macOS 13 or newer.'
      }
    }
    if (!qwenModelManager.ensureSupportedModel(modelId)) {
      return { ok: false, message: 'Unsupported local model.' }
    }
    if (!qwenModelManager.isModelDownloaded(modelId)) {
      return { ok: false, message: 'Local model is not downloaded.' }
    }
    try {
      await this.host.warm(getQwenModelDir(modelId))
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to warm local Qwen.'
      }
    }
  }

  async stopRuntime(): Promise<LocalModelActionResponse> {
    await this.host.stop()
    return { ok: true }
  }

  async transcribeArtifact(
    artifactPath: string,
    modelId: string
  ): Promise<QwenTranscriptionRuntimeResult> {
    if (!isQwenMlxSupported()) {
      throw new LocalQwenError(
        'local_runtime_unavailable',
        'Local Qwen currently requires Apple Silicon and macOS 13 or newer.'
      )
    }
    if (!qwenModelManager.ensureSupportedModel(modelId)) {
      throw new LocalQwenError('local_transcription_failed', 'Unsupported local model.')
    }
    if (!this.host.isAvailable()) {
      throw new LocalQwenError(
        'local_runtime_unavailable',
        'The Qwen MLX host is unavailable. Reinstall the app.'
      )
    }
    if (!qwenModelManager.isModelDownloaded(modelId)) {
      throw new LocalQwenError('local_model_not_downloaded', 'Local model is not downloaded.')
    }
    if (!getFfmpegPath()) {
      throw new LocalQwenError(
        'local_runtime_unavailable',
        'FFmpeg is unavailable. Reinstall the app.'
      )
    }

    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'openvocaly-qwen-'))
    const wavPath = join(temporaryDirectory, 'audio.wav')
    const startedAt = Date.now()
    try {
      await convertFileToWav(artifactPath, wavPath, {
        sampleRate: QWEN_SAMPLE_RATE,
        channels: 1
      })
      const result = await this.host.transcribe(getQwenModelDir(modelId), wavPath)
      const text = result.text.trim()
      return {
        text,
        language: result.language,
        diagnostics: {
          providerId: 'local-qwen',
          modelId: modelId as QwenModelId,
          durationMs: result.durationMs,
          chunkCount: 1,
          resultType: text ? 'success_full' : 'failed_empty',
          chunks: [
            {
              chunkIndex: 1,
              chunkCount: 1,
              attempt: 1,
              restarted: false,
              resultType: text ? 'success_full' : 'failed_empty',
              elapsedMs: Date.now() - startedAt
            }
          ]
        }
      }
    } catch (error) {
      throw new LocalQwenError(
        'local_transcription_failed',
        error instanceof Error ? error.message : 'Local Qwen transcription failed.'
      )
    } finally {
      await safeCleanupPaths([temporaryDirectory])
    }
  }
}

export const qwenRuntime = new QwenRuntime()
