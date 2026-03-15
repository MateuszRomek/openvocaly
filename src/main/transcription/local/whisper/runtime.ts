import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  ListLocalModelsResponse,
  LocalModelActionResponse,
  LocalModelDownloadProgress,
  LocalRuntimeStatusResponse
} from '../../../../shared/local-transcription'
import {
  convertFileToWav,
  estimatePcm16WavDurationMs,
  getFfmpegPath,
  safeCleanupPaths,
  splitWavFileIntoChunks
} from '../ffmpeg-utils'
import { LocalWhisperError } from './errors'
import { whisperModelManager } from './model-manager'
import { WhisperServerClient } from './server-client'

const WHISPER_SAMPLE_RATE = 16000
const LONG_AUDIO_SEGMENT_SECONDS = 45
const LONG_AUDIO_SEGMENT_THRESHOLD_MS = LONG_AUDIO_SEGMENT_SECONDS * 1000

const normalizeWhisperText = (text: string): string => text.replace(/\s+/g, ' ').trim()

export class WhisperRuntime {
  private readonly serverClient = new WhisperServerClient()

  private isPlatformSupported(): boolean {
    return process.platform === 'darwin'
  }

  async listModels(): Promise<ListLocalModelsResponse> {
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
    modelId: string,
    onProgress?: (progress: LocalModelDownloadProgress) => void
  ): Promise<LocalModelActionResponse> {
    if (!whisperModelManager.ensureSupportedModel(modelId)) {
      return { ok: false, message: 'Unsupported local model.' }
    }

    try {
      await whisperModelManager.downloadModel(modelId, onProgress)
      return { ok: true }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to download local Whisper model.'
      return { ok: false, message }
    }
  }

  cancelDownload(): LocalModelActionResponse {
    const cancelled = whisperModelManager.cancelDownload()
    return cancelled
      ? { ok: true, message: 'Download cancelled.' }
      : { ok: false, message: 'No cancellable download in progress.' }
  }

  async deleteModel(modelId: string): Promise<LocalModelActionResponse> {
    if (!whisperModelManager.ensureSupportedModel(modelId)) {
      return { ok: false, message: 'Unsupported local model.' }
    }

    const deleted = await whisperModelManager.deleteModel(modelId)
    if (deleted) {
      await this.serverClient.stop()
      return { ok: true }
    }

    return { ok: false, message: 'Model not found.' }
  }

  getRuntimeStatus(): LocalRuntimeStatusResponse {
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

  async startRuntime(modelId: string): Promise<LocalModelActionResponse> {
    if (!this.isPlatformSupported()) {
      return { ok: false, message: 'Local Whisper is currently supported on macOS only.' }
    }

    if (!whisperModelManager.ensureSupportedModel(modelId)) {
      return { ok: false, message: 'Unsupported local model.' }
    }

    if (!whisperModelManager.isModelDownloaded(modelId)) {
      return { ok: false, message: 'Local model is not downloaded.' }
    }

    try {
      await this.serverClient.start(modelId)
      return { ok: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start local runtime.'
      return { ok: false, message }
    }
  }

  async stopRuntime(): Promise<LocalModelActionResponse> {
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
    let chunksDir: string | null = null
    let chunkPaths: string[] = [wavPath]

    try {
      await convertFileToWav(artifactPath, wavPath, {
        sampleRate: WHISPER_SAMPLE_RATE,
        channels: 1
      })

      const durationMs = await estimatePcm16WavDurationMs(wavPath, {
        sampleRate: WHISPER_SAMPLE_RATE,
        channels: 1
      })

      if (durationMs > LONG_AUDIO_SEGMENT_THRESHOLD_MS) {
        const split = await splitWavFileIntoChunks(wavPath, {
          chunkDurationSeconds: LONG_AUDIO_SEGMENT_SECONDS,
          chunkFilePrefix: 'openvocaly-whisper-chunks'
        })
        chunksDir = split.chunksDir
        chunkPaths = split.chunkPaths
      }

      await this.serverClient.start(modelId)
      const transcriptChunks: string[] = []

      for (const chunkPath of chunkPaths) {
        const wavBuffer = await readFile(chunkPath)
        const chunkText = await this.serverClient.transcribe(wavBuffer)
        const trimmedChunk = normalizeWhisperText(chunkText)

        if (trimmedChunk.length > 0) {
          transcriptChunks.push(trimmedChunk)
        }
      }

      const text = transcriptChunks.join(' ').trim()
      return { text, language: 'auto' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Local Whisper transcription failed.'
      throw new LocalWhisperError('local_transcription_failed', message)
    } finally {
      const cleanupTargets = [wavPath]
      if (chunksDir) {
        cleanupTargets.push(chunksDir)
      }

      await safeCleanupPaths(cleanupTargets)
    }
  }
}

export const whisperRuntime = new WhisperRuntime()
