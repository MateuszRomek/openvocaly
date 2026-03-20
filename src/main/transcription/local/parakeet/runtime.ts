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
  convertFileToWav,
  estimatePcm16WavDurationMs,
  getFfmpegPath,
  safeCleanupPaths,
  wavFileToFloat32Buffer
} from '../ffmpeg-utils'
import { buildOverlappingWindows, mergeTranscriptChunkText } from '../chunking'
import { LocalParakeetError } from './errors'
import { parakeetModelManager } from './model-manager'
import type { ParakeetModelId } from './model-catalog'
import { ParakeetWsClient } from './ws-client'

const PARAKEET_SAMPLE_RATE = 16000
const CHUNK_DURATION_SECONDS = 12
const CHUNK_OVERLAP_MS = 2000
const CHUNK_RETRY_ATTEMPTS = 2
const FAILED_CHUNK_RESCUE_CONTEXT_MS = 2000
const TAIL_RESCUE_WINDOW_SECONDS = 20
const TAIL_COVERAGE_GAP_MS = 400

type TranscribeArtifactOptions = {
  sessionId?: string
}

type ParakeetChunkSegment = {
  chunkIndex: number
  chunkCount: number
  startSample: number
  endSample: number
  durationMs: number
  samples: Buffer
}

type ChunkTranscriptionResult = {
  text: string
  attempts: TranscriptionChunkDiagnostics[]
}

export type ParakeetTranscriptionRuntimeResult = {
  text: string
  language?: string
  diagnostics: TranscriptionDiagnostics
}

export class ParakeetRuntime {
  private readonly logger = createLogger('transcription.local.parakeet.runtime')
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
    modelId: string,
    onProgress?: (progress: LocalModelDownloadProgress) => void
  ): Promise<LocalModelActionResponse> {
    if (!parakeetModelManager.ensureSupportedModel(modelId)) {
      return { ok: false, message: 'Unsupported local model.' }
    }

    try {
      await parakeetModelManager.downloadModel(modelId, onProgress)
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

  async deleteModel(modelId: string): Promise<LocalModelActionResponse> {
    if (!parakeetModelManager.ensureSupportedModel(modelId)) {
      return { ok: false, message: 'Unsupported local model.' }
    }

    const deleted = await parakeetModelManager.deleteModel(modelId)
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

  async startRuntime(modelId: string): Promise<LocalModelActionResponse> {
    if (!this.isPlatformSupported()) {
      return { ok: false, message: 'Local Parakeet is currently supported on macOS only.' }
    }

    if (!parakeetModelManager.ensureSupportedModel(modelId)) {
      return { ok: false, message: 'Unsupported local model.' }
    }

    if (!parakeetModelManager.isModelDownloaded(modelId)) {
      return { ok: false, message: 'Local model is not downloaded.' }
    }

    try {
      await this.wsClient.start(modelId)
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
    modelId: string,
    options: TranscribeArtifactOptions = {}
  ): Promise<ParakeetTranscriptionRuntimeResult> {
    const startedAt = Date.now()

    if (!this.isPlatformSupported()) {
      throw new LocalParakeetError(
        'local_runtime_unavailable',
        'Local Parakeet is currently supported on macOS only.'
      )
    }

    if (!parakeetModelManager.ensureSupportedModel(modelId)) {
      throw new LocalParakeetError('local_transcription_failed', 'Unsupported local model.')
    }
    const resolvedModelId: ParakeetModelId = modelId

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

      const durationMs = await estimatePcm16WavDurationMs(wavPath, {
        sampleRate: PARAKEET_SAMPLE_RATE,
        channels: 1
      })

      const float32Samples = await wavFileToFloat32Buffer(wavPath)
      const segments = this.splitIntoSegments(float32Samples)
      const audioRms = this.computeRms(float32Samples)

      this.logger.debug({
        event: 'parakeet_transcription_started',
        sessionId: options.sessionId ?? null,
        modelId: resolvedModelId,
        durationMs,
        sampleBytes: float32Samples.length,
        audioRms,
        chunkCount: segments.length,
        chunkDurationSeconds: CHUNK_DURATION_SECONDS,
        chunkOverlapMs: CHUNK_OVERLAP_MS
      })

      await this.wsClient.start(resolvedModelId)
      let mergedText = ''
      let failedChunkIndexes: number[] = []
      const failedSegments: ParakeetChunkSegment[] = []
      const chunkDiagnostics: TranscriptionChunkDiagnostics[] = []
      const sampleCount = Math.floor(float32Samples.length / 4)
      let maxCoveredEndSample = 0

      for (const segment of segments) {
        const segmentResult = await this.transcribeChunkWithRetry(
          segment,
          resolvedModelId,
          options.sessionId
        )
        chunkDiagnostics.push(...segmentResult.attempts)

        if (!segmentResult.text) {
          failedChunkIndexes.push(segment.chunkIndex)
          failedSegments.push(segment)
          continue
        }

        mergedText = mergeTranscriptChunkText(mergedText, segmentResult.text)
        maxCoveredEndSample = Math.max(maxCoveredEndSample, segment.endSample)
      }

      if (failedSegments.length > 0) {
        this.logger.debug({
          event: 'parakeet_failed_chunk_rescue_started',
          sessionId: options.sessionId ?? null,
          modelId: resolvedModelId,
          failedChunkIndexes
        })

        const rescuedChunkIndexes = new Set<number>()
        for (const failedSegment of failedSegments) {
          const rescueSegment = this.expandSegmentContext(failedSegment, float32Samples)
          const rescueResult = await this.transcribeChunkWithRetry(
            rescueSegment,
            resolvedModelId,
            options.sessionId
          )
          chunkDiagnostics.push(...rescueResult.attempts)

          if (!rescueResult.text.trim()) {
            continue
          }

          rescuedChunkIndexes.add(failedSegment.chunkIndex)
          mergedText = mergeTranscriptChunkText(mergedText, rescueResult.text)
          maxCoveredEndSample = Math.max(maxCoveredEndSample, failedSegment.endSample)
        }

        if (rescuedChunkIndexes.size > 0) {
          failedChunkIndexes = failedChunkIndexes.filter((index) => !rescuedChunkIndexes.has(index))
          this.logger.debug({
            event: 'parakeet_failed_chunk_rescue_completed',
            sessionId: options.sessionId ?? null,
            modelId: resolvedModelId,
            rescuedChunkIndexes: Array.from(rescuedChunkIndexes).sort((a, b) => a - b),
            remainingFailedChunkIndexes: failedChunkIndexes
          })
        }
      }

      const tailCoverageGapSamples = Math.max(0, sampleCount - maxCoveredEndSample)
      const tailCoverageGapMs = Math.round((tailCoverageGapSamples * 1000) / PARAKEET_SAMPLE_RATE)
      if (tailCoverageGapMs >= TAIL_COVERAGE_GAP_MS && sampleCount > 0) {
        this.logger.debug({
          event: 'parakeet_tail_rescue_started',
          sessionId: options.sessionId ?? null,
          modelId: resolvedModelId,
          tailCoverageGapMs
        })

        const tailRescueSegment = this.buildTailRescueSegment(float32Samples, segments.length)
        const tailRescueResult = await this.transcribeChunkWithRetry(
          tailRescueSegment,
          resolvedModelId,
          options.sessionId
        )
        chunkDiagnostics.push(...tailRescueResult.attempts)

        if (tailRescueResult.text.trim()) {
          mergedText = mergeTranscriptChunkText(mergedText, tailRescueResult.text)
          maxCoveredEndSample = sampleCount
          failedChunkIndexes = failedChunkIndexes.filter(
            (index) => index !== tailRescueSegment.chunkIndex
          )
        }

        this.logger.debug({
          event: 'parakeet_tail_rescue_completed',
          sessionId: options.sessionId ?? null,
          modelId: resolvedModelId,
          rescued: Boolean(tailRescueResult.text.trim()),
          remainingFailedChunkIndexes: failedChunkIndexes
        })
      }

      if (
        !mergedText.trim() &&
        segments.length > 1 &&
        failedChunkIndexes.length === segments.length
      ) {
        this.logger.warn({
          event: 'parakeet_all_chunks_empty_retry_full_audio',
          sessionId: options.sessionId ?? null,
          modelId: resolvedModelId,
          chunkCount: segments.length
        })

        const fullAudioSegment: ParakeetChunkSegment = {
          chunkIndex: 1,
          chunkCount: 1,
          startSample: 0,
          endSample: Math.floor(float32Samples.length / 4),
          durationMs,
          samples: float32Samples
        }

        const fullAudioResult = await this.transcribeChunkWithRetry(
          fullAudioSegment,
          resolvedModelId,
          options.sessionId
        )
        chunkDiagnostics.push(...fullAudioResult.attempts)

        if (fullAudioResult.text.trim()) {
          mergedText = fullAudioResult.text.trim()
          failedChunkIndexes.length = 0
          maxCoveredEndSample = sampleCount
        }
      }

      const normalizedText = mergedText.trim()
      const partial = normalizedText.length > 0 && failedChunkIndexes.length > 0
      const text = normalizedText
      const resultType = this.resolveOverallResultType({
        text,
        failedChunkIndexes,
        chunkDiagnostics
      })

      const diagnostics: TranscriptionDiagnostics = {
        providerId: 'local-parakeet',
        modelId: resolvedModelId,
        partial,
        resultType,
        durationMs,
        chunkCount: segments.length,
        chunkDurationSeconds: CHUNK_DURATION_SECONDS,
        chunkOverlapMs: CHUNK_OVERLAP_MS,
        failedChunkIndexes,
        chunks: chunkDiagnostics
      }

      this.logger.debug({
        event: 'parakeet_transcription_completed',
        sessionId: options.sessionId ?? null,
        modelId: resolvedModelId,
        durationMs,
        totalElapsedMs: Date.now() - startedAt,
        textLength: text.length,
        partial,
        resultType,
        chunkCount: segments.length,
        failedChunkIndexes
      })

      return { text, language: 'auto', diagnostics }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Local Parakeet transcription failed.'

      this.logger.error({
        event: 'parakeet_transcription_failed',
        sessionId: options.sessionId ?? null,
        modelId: resolvedModelId,
        elapsedMs: Date.now() - startedAt,
        message
      })

      throw new LocalParakeetError('local_transcription_failed', message)
    } finally {
      await safeCleanupPaths([wavPath])
    }
  }

  private async transcribeChunkWithRetry(
    segment: ParakeetChunkSegment,
    modelId: ParakeetModelId,
    sessionId?: string
  ): Promise<ChunkTranscriptionResult> {
    const attempts: TranscriptionChunkDiagnostics[] = []
    const chunkRms = this.computeRms(segment.samples)

    for (let attempt = 1; attempt <= CHUNK_RETRY_ATTEMPTS; attempt += 1) {
      const restarted = attempt > 1

      if (restarted) {
        try {
          await this.wsClient.stop()
          await this.wsClient.start(modelId)
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to restart local Parakeet runtime.'
          const elapsedMs = 0
          attempts.push({
            chunkIndex: segment.chunkIndex,
            chunkCount: segment.chunkCount,
            attempt,
            restarted,
            resultType: 'failed_runtime',
            elapsedMs,
            message
          })

          this.logger.warn({
            event: 'parakeet_chunk_restart_failed',
            sessionId: sessionId ?? null,
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
        const text = await this.wsClient.transcribe(segment.samples, PARAKEET_SAMPLE_RATE)
        const elapsedMs = Date.now() - attemptStartedAt
        const trimmed = text.trim()

        if (trimmed.length > 0) {
          attempts.push({
            chunkIndex: segment.chunkIndex,
            chunkCount: segment.chunkCount,
            attempt,
            restarted,
            resultType: 'success_full',
            elapsedMs
          })

          this.logger.debug({
            event: 'parakeet_chunk_success',
            sessionId: sessionId ?? null,
            modelId,
            chunkIndex: segment.chunkIndex,
            chunkCount: segment.chunkCount,
            attempt,
            restarted,
            elapsedMs,
            chunkRms,
            textLength: trimmed.length
          })

          return { text: trimmed, attempts }
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
          event: 'parakeet_chunk_empty',
          sessionId: sessionId ?? null,
          modelId,
          chunkIndex: segment.chunkIndex,
          chunkCount: segment.chunkCount,
          attempt,
          restarted,
          elapsedMs,
          chunkRms
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
          event: 'parakeet_chunk_failed',
          sessionId: sessionId ?? null,
          modelId,
          chunkIndex: segment.chunkIndex,
          chunkCount: segment.chunkCount,
          attempt,
          restarted,
          elapsedMs,
          chunkRms,
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

  private splitIntoSegments(float32Samples: Buffer): ParakeetChunkSegment[] {
    const sampleCount = Math.floor(float32Samples.length / 4)
    const chunkSamples = CHUNK_DURATION_SECONDS * PARAKEET_SAMPLE_RATE
    const overlapSamples = Math.floor((CHUNK_OVERLAP_MS * PARAKEET_SAMPLE_RATE) / 1000)
    const windows = buildOverlappingWindows(sampleCount, chunkSamples, overlapSamples)

    return windows.map((window) =>
      this.toSegmentFromWindow(float32Samples, {
        chunkIndex: window.windowIndex,
        chunkCount: window.windowCount,
        startSample: window.startUnit,
        endSample: window.endUnit
      })
    )
  }

  private toSegmentFromWindow(
    float32Samples: Buffer,
    window: {
      chunkIndex: number
      chunkCount: number
      startSample: number
      endSample: number
    }
  ): ParakeetChunkSegment {
    const clampedStart = Math.max(0, window.startSample)
    const clampedEnd = Math.max(clampedStart, window.endSample)
    const startByte = clampedStart * 4
    const endByte = clampedEnd * 4

    return {
      chunkIndex: window.chunkIndex,
      chunkCount: window.chunkCount,
      startSample: clampedStart,
      endSample: clampedEnd,
      durationMs: Math.round(((clampedEnd - clampedStart) * 1000) / PARAKEET_SAMPLE_RATE),
      samples: float32Samples.subarray(startByte, endByte)
    }
  }

  private expandSegmentContext(
    segment: ParakeetChunkSegment,
    float32Samples: Buffer
  ): ParakeetChunkSegment {
    const totalSampleCount = Math.floor(float32Samples.length / 4)
    const contextSamples = Math.floor(
      (FAILED_CHUNK_RESCUE_CONTEXT_MS * PARAKEET_SAMPLE_RATE) / 1000
    )
    const startSample = Math.max(0, segment.startSample - contextSamples)
    const endSample = Math.min(totalSampleCount, segment.endSample + contextSamples)

    return this.toSegmentFromWindow(float32Samples, {
      chunkIndex: segment.chunkIndex,
      chunkCount: segment.chunkCount,
      startSample,
      endSample
    })
  }

  private buildTailRescueSegment(float32Samples: Buffer, chunkCount: number): ParakeetChunkSegment {
    const totalSampleCount = Math.floor(float32Samples.length / 4)
    const tailWindowSamples = TAIL_RESCUE_WINDOW_SECONDS * PARAKEET_SAMPLE_RATE
    const startSample = Math.max(0, totalSampleCount - tailWindowSamples)

    return this.toSegmentFromWindow(float32Samples, {
      chunkIndex: chunkCount,
      chunkCount,
      startSample,
      endSample: totalSampleCount
    })
  }

  private computeRms(float32Samples: Buffer): number {
    const sampleCount = Math.floor(float32Samples.length / 4)
    if (sampleCount <= 0) {
      return 0
    }

    let sumSquares = 0
    for (let index = 0; index < sampleCount; index += 1) {
      const sample = float32Samples.readFloatLE(index * 4)
      sumSquares += sample * sample
    }

    return Math.sqrt(sumSquares / sampleCount)
  }
}

export const parakeetRuntime = new ParakeetRuntime()
