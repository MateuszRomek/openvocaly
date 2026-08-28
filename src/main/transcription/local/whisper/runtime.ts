import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  ListLocalModelsResponse,
  LocalModelActionResponse,
  LocalModelDownloadProgress,
  LocalRuntimeStatusResponse
} from '../../../../shared/local-transcription'
import type {
  TranscriptionChunkDiagnostics,
  TranscriptionDiagnostics,
  TranscriptionDiagnosticsResultType
} from '../../../../shared/transcription'
import { createLogger } from '../../../helpers/logger'
import {
  buildPcm16WavBuffer,
  convertFileToWav,
  estimatePcm16WavDurationMs,
  getFfmpegPath,
  type Pcm16WavData,
  readPcm16WavData,
  safeCleanupPaths
} from '../ffmpeg-utils'
import { buildOverlappingWindows, mergeTranscriptChunkText } from '../chunking'
import { LocalWhisperError } from './errors'
import { whisperModelManager } from './model-manager'
import type { WhisperModelId } from './model-catalog'
import { WhisperServerClient } from './server-client'

const WHISPER_SAMPLE_RATE = 16000
const LONG_AUDIO_SEGMENT_THRESHOLD_SECONDS = 45
const LONG_AUDIO_SEGMENT_THRESHOLD_MS = LONG_AUDIO_SEGMENT_THRESHOLD_SECONDS * 1000
const LONG_AUDIO_WINDOW_SECONDS = 30
const LONG_AUDIO_WINDOW_OVERLAP_MS = 2000
const WINDOW_TRANSCRIBE_ATTEMPTS = 2
const TAIL_RESCUE_WINDOW_SECONDS = 20
const TAIL_COVERAGE_GAP_MS = 400

const normalizeWhisperText = (text: string): string => text.replace(/\s+/g, ' ').trim()

type WhisperChunkSegment = {
  chunkIndex: number
  chunkCount: number
  startMs: number
  endMs: number
}

type WhisperWindowTranscriptionResult = {
  text: string
  attempts: TranscriptionChunkDiagnostics[]
}

export type WhisperTranscriptionRuntimeResult = {
  text: string
  language?: string
  diagnostics: TranscriptionDiagnostics
}

export class WhisperRuntime {
  private readonly logger = createLogger('transcription.local.whisper.runtime')
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
    modelId: string,
    signal?: AbortSignal
  ): Promise<WhisperTranscriptionRuntimeResult> {
    const startedAt = Date.now()

    if (!this.isPlatformSupported()) {
      throw new LocalWhisperError(
        'local_runtime_unavailable',
        'Local Whisper is currently supported on macOS only.'
      )
    }

    if (!whisperModelManager.ensureSupportedModel(modelId)) {
      throw new LocalWhisperError('local_transcription_failed', 'Unsupported local model.')
    }
    const resolvedModelId: WhisperModelId = modelId

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
        channels: 1,
        signal
      })

      const durationMs = await estimatePcm16WavDurationMs(wavPath, {
        sampleRate: WHISPER_SAMPLE_RATE,
        channels: 1
      })

      const segments = this.buildSegments(durationMs)
      const pcm16Wav = await readPcm16WavData(wavPath)

      await this.serverClient.start(modelId)
      this.logger.debug({
        event: 'whisper_transcription_started',
        modelId: resolvedModelId,
        durationMs,
        chunkCount: segments.length,
        chunkDurationSeconds: LONG_AUDIO_WINDOW_SECONDS,
        chunkOverlapMs: LONG_AUDIO_WINDOW_OVERLAP_MS
      })

      let mergedText = ''
      let failedChunkIndexes: number[] = []
      const chunkDiagnostics: TranscriptionChunkDiagnostics[] = []
      let maxCoveredEndMs = 0

      for (const segment of segments) {
        if (signal?.aborted) {
          throw new Error('Local Whisper transcription cancelled.')
        }
        const segmentWavBuffer = this.buildSegmentWavBuffer(segment, pcm16Wav)
        const segmentResult = await this.transcribeWindowWithRetry(
          segment,
          segmentWavBuffer,
          resolvedModelId,
          signal
        )
        chunkDiagnostics.push(...segmentResult.attempts)

        if (!segmentResult.text) {
          if (this.hasHardChunkFailure(segmentResult.attempts)) {
            failedChunkIndexes.push(segment.chunkIndex)
          }
          continue
        }

        mergedText = mergeTranscriptChunkText(mergedText, segmentResult.text)
        maxCoveredEndMs = Math.max(maxCoveredEndMs, segment.endMs)
      }

      const tailCoverageGapMs = Math.max(0, durationMs - maxCoveredEndMs)
      if (tailCoverageGapMs >= TAIL_COVERAGE_GAP_MS && durationMs > 0) {
        this.logger.debug({
          event: 'whisper_tail_rescue_started',
          modelId: resolvedModelId,
          tailCoverageGapMs
        })

        const tailRescueSegment = this.buildTailRescueSegment(durationMs, segments.length)
        const tailWavBuffer = this.buildSegmentWavBuffer(tailRescueSegment, pcm16Wav)
        const tailRescueResult = await this.transcribeWindowWithRetry(
          tailRescueSegment,
          tailWavBuffer,
          resolvedModelId,
          signal
        )
        chunkDiagnostics.push(...tailRescueResult.attempts)

        if (tailRescueResult.text.trim()) {
          mergedText = mergeTranscriptChunkText(mergedText, tailRescueResult.text)
          maxCoveredEndMs = durationMs
          failedChunkIndexes = failedChunkIndexes.filter(
            (index) => index !== tailRescueSegment.chunkIndex
          )
        }

        this.logger.debug({
          event: 'whisper_tail_rescue_completed',
          modelId: resolvedModelId,
          rescued: Boolean(tailRescueResult.text.trim()),
          remainingFailedChunkIndexes: failedChunkIndexes
        })
      }

      const text = normalizeWhisperText(mergedText)
      const partial = text.length > 0 && failedChunkIndexes.length > 0
      const resultType = this.resolveOverallResultType({
        text,
        failedChunkIndexes,
        chunkDiagnostics
      })
      const diagnostics: TranscriptionDiagnostics = {
        providerId: 'local-whisper',
        modelId: resolvedModelId,
        partial,
        resultType,
        durationMs,
        chunkCount: segments.length,
        chunkDurationSeconds: LONG_AUDIO_WINDOW_SECONDS,
        chunkOverlapMs: LONG_AUDIO_WINDOW_OVERLAP_MS,
        failedChunkIndexes,
        chunks: chunkDiagnostics
      }

      this.logger.debug({
        event: 'whisper_transcription_completed',
        modelId: resolvedModelId,
        durationMs,
        totalElapsedMs: Date.now() - startedAt,
        textLength: text.length,
        partial,
        resultType,
        chunkCount: segments.length,
        failedChunkIndexes
      })

      return {
        text,
        language: 'auto',
        diagnostics
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Local Whisper transcription failed.'
      throw new LocalWhisperError('local_transcription_failed', message)
    } finally {
      await safeCleanupPaths([wavPath])
    }
  }

  private buildSegments(durationMs: number): WhisperChunkSegment[] {
    const totalMs = Math.max(0, Math.floor(durationMs))
    if (totalMs <= LONG_AUDIO_SEGMENT_THRESHOLD_MS) {
      return [
        {
          chunkIndex: 1,
          chunkCount: 1,
          startMs: 0,
          endMs: totalMs
        }
      ]
    }

    const windows = buildOverlappingWindows(
      totalMs,
      LONG_AUDIO_WINDOW_SECONDS * 1000,
      LONG_AUDIO_WINDOW_OVERLAP_MS
    )

    return windows.map((window) => ({
      chunkIndex: window.windowIndex,
      chunkCount: window.windowCount,
      startMs: window.startUnit,
      endMs: window.endUnit
    }))
  }

  private buildSegmentWavBuffer(segment: WhisperChunkSegment, wavData: Pcm16WavData): Buffer {
    const frameSize = wavData.channels * 2
    const totalFrames = Math.floor(wavData.sampleBytes.length / frameSize)
    const startFrame = Math.max(0, Math.floor((segment.startMs * wavData.sampleRate) / 1000))
    const endFrame = Math.max(startFrame, Math.floor((segment.endMs * wavData.sampleRate) / 1000))
    const boundedStartFrame = Math.min(totalFrames, startFrame)
    const boundedEndFrame = Math.min(totalFrames, endFrame)
    const startByte = boundedStartFrame * frameSize
    const endByte = boundedEndFrame * frameSize
    const sampleBytes = wavData.sampleBytes.subarray(startByte, endByte)

    return buildPcm16WavBuffer(sampleBytes, {
      sampleRate: wavData.sampleRate,
      channels: wavData.channels
    })
  }

  private buildTailRescueSegment(durationMs: number, chunkCount: number): WhisperChunkSegment {
    const startMs = Math.max(0, durationMs - TAIL_RESCUE_WINDOW_SECONDS * 1000)

    return {
      chunkIndex: chunkCount,
      chunkCount,
      startMs,
      endMs: durationMs
    }
  }

  private async transcribeWindowWithRetry(
    segment: WhisperChunkSegment,
    wavBuffer: Buffer,
    modelId: WhisperModelId,
    signal?: AbortSignal
  ): Promise<WhisperWindowTranscriptionResult> {
    const attempts: TranscriptionChunkDiagnostics[] = []

    for (let attempt = 1; attempt <= WINDOW_TRANSCRIBE_ATTEMPTS; attempt += 1) {
      if (signal?.aborted) {
        throw new Error('Local Whisper transcription cancelled.')
      }
      const restarted = attempt > 1

      if (restarted) {
        try {
          await this.serverClient.stop()
          await this.serverClient.start(modelId)
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to restart local Whisper runtime.'
          attempts.push({
            chunkIndex: segment.chunkIndex,
            chunkCount: segment.chunkCount,
            attempt,
            restarted,
            resultType: 'failed_runtime',
            elapsedMs: 0,
            message
          })

          this.logger.warn({
            event: 'whisper_chunk_restart_failed',
            modelId,
            chunkIndex: segment.chunkIndex,
            chunkCount: segment.chunkCount,
            attempt,
            message
          })
          break
        }
      }

      const attemptStartedAt = Date.now()

      try {
        const text = await this.serverClient.transcribe(wavBuffer, signal)
        const elapsedMs = Date.now() - attemptStartedAt
        const normalized = normalizeWhisperText(text)

        if (normalized.length > 0) {
          attempts.push({
            chunkIndex: segment.chunkIndex,
            chunkCount: segment.chunkCount,
            attempt,
            restarted,
            resultType: 'success_full',
            elapsedMs
          })

          this.logger.debug({
            event: 'whisper_chunk_success',
            modelId,
            chunkIndex: segment.chunkIndex,
            chunkCount: segment.chunkCount,
            attempt,
            restarted,
            elapsedMs,
            textLength: normalized.length
          })

          return { text: normalized, attempts }
        }

        attempts.push({
          chunkIndex: segment.chunkIndex,
          chunkCount: segment.chunkCount,
          attempt,
          restarted,
          resultType: 'failed_empty',
          elapsedMs
        })

        this.logger.warn({
          event: 'whisper_chunk_empty',
          modelId,
          chunkIndex: segment.chunkIndex,
          chunkCount: segment.chunkCount,
          attempt,
          restarted,
          elapsedMs
        })
      } catch (error) {
        const elapsedMs = Date.now() - attemptStartedAt
        const message = error instanceof Error ? error.message : 'Unknown local runtime error.'
        const resultType = this.classifyChunkFailure(error)

        attempts.push({
          chunkIndex: segment.chunkIndex,
          chunkCount: segment.chunkCount,
          attempt,
          restarted,
          resultType,
          elapsedMs,
          message
        })

        this.logger.warn({
          event: 'whisper_chunk_failed',
          modelId,
          chunkIndex: segment.chunkIndex,
          chunkCount: segment.chunkCount,
          attempt,
          restarted,
          elapsedMs,
          resultType,
          message
        })
      }
    }

    return { text: '', attempts }
  }

  private classifyChunkFailure(
    error: unknown
  ): Exclude<
    TranscriptionDiagnosticsResultType,
    'success_full' | 'success_partial' | 'failed_empty'
  > {
    const message = error instanceof Error ? error.message.toLowerCase() : ''

    if (message.includes('timed out') || message.includes('timeout')) {
      return 'failed_timeout'
    }

    if (message.includes('protocol') || message.includes('parse')) {
      return 'failed_protocol'
    }

    return 'failed_runtime'
  }

  private hasHardChunkFailure(attempts: TranscriptionChunkDiagnostics[]): boolean {
    return attempts.some(
      (attempt) =>
        attempt.resultType === 'failed_runtime' ||
        attempt.resultType === 'failed_timeout' ||
        attempt.resultType === 'failed_protocol'
    )
  }

  private resolveOverallResultType(params: {
    text: string
    failedChunkIndexes: number[]
    chunkDiagnostics: TranscriptionChunkDiagnostics[]
  }): TranscriptionDiagnosticsResultType {
    if (params.text.length > 0 && params.failedChunkIndexes.length === 0) {
      return 'success_full'
    }

    if (params.text.length > 0 && params.failedChunkIndexes.length > 0) {
      return 'success_partial'
    }

    const failureTypes = params.chunkDiagnostics
      .map((chunk) => chunk.resultType)
      .filter((type): type is TranscriptionDiagnosticsResultType => type.startsWith('failed_'))

    if (failureTypes.includes('failed_timeout')) {
      return 'failed_timeout'
    }

    if (failureTypes.includes('failed_protocol')) {
      return 'failed_protocol'
    }

    if (failureTypes.includes('failed_runtime')) {
      return 'failed_runtime'
    }

    return 'failed_empty'
  }
}

export const whisperRuntime = new WhisperRuntime()
