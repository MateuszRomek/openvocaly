import type { RecordingArtifact } from '../../../shared/recording'
import type { TranscriptAddedEvent } from '../../../shared/storage'
import type {
  ListLocalModelsResponse,
  LocalModelActionInput,
  LocalModelActionResponse,
  LocalModelDownloadProgress,
  LocalProviderActionInput,
  LocalTranscriptionProviderId,
  LocalRuntimeStatusResponse
} from '../../../shared/local-transcription'
import type {
  TranscriptionPreferences,
  TranscriptionPreferencesResponse,
  TranscriptionPreferencesUpdateInput,
  TranscriptionResult
} from '../../../shared/transcription'
import { SettingsRepository } from '../../repositories/settings-repository'
import { StorageRepository } from '../../repositories/storage-repository'
import { AsyncSerialScheduler } from '../../helpers/async-serial-scheduler'
import { InitializableComponent } from '../../helpers/initializable-component'
import { emitTranscriptAddedEvent } from '../../storage/transcript-events'
import { macOSParakeetRuntime } from '../local/macos-asr-host/runtime'
import { whisperRuntime } from '../local/whisper/runtime'
import { qwenRuntime } from '../local/qwen/runtime'
import { resolveDefaultTranscriptionProviderId } from '../provider-helpers'
import { TranscriptionProviderFactory } from '../provider-factory'
import type { TranscriptionArtifact } from '../providers/types'
import { TranscriptionPreferencesManager } from './preferences-manager'

type LocalRuntimeController = {
  listModels: () => Promise<ListLocalModelsResponse>
  downloadModel: (
    modelId: string,
    onProgress?: (progress: LocalModelDownloadProgress) => void
  ) => Promise<LocalModelActionResponse>
  cancelDownload: () => LocalModelActionResponse
  deleteModel: (modelId: string) => Promise<LocalModelActionResponse>
  getRuntimeStatus: () => LocalRuntimeStatusResponse
  startRuntime: (modelId: string) => Promise<LocalModelActionResponse>
  stopRuntime: () => Promise<LocalModelActionResponse>
}

const LOCAL_PROVIDER_IDS = new Set<LocalTranscriptionProviderId>([
  'local-parakeet',
  'local-whisper',
  'local-qwen'
])

const DEFAULT_LOCAL_RUNTIMES: Record<LocalTranscriptionProviderId, LocalRuntimeController> = {
  'local-parakeet': {
    listModels: () => macOSParakeetRuntime.listModels(),
    downloadModel: (modelId, onProgress) => macOSParakeetRuntime.downloadModel(modelId, onProgress),
    cancelDownload: () => macOSParakeetRuntime.cancelDownload(),
    deleteModel: (modelId) => macOSParakeetRuntime.deleteModel(modelId),
    getRuntimeStatus: () => macOSParakeetRuntime.getRuntimeStatus(),
    startRuntime: (modelId) => macOSParakeetRuntime.startRuntime(modelId),
    stopRuntime: () => macOSParakeetRuntime.stopRuntime()
  },
  'local-whisper': {
    listModels: () => whisperRuntime.listModels(),
    downloadModel: (modelId, onProgress) => whisperRuntime.downloadModel(modelId, onProgress),
    cancelDownload: () => whisperRuntime.cancelDownload(),
    deleteModel: (modelId) => whisperRuntime.deleteModel(modelId),
    getRuntimeStatus: () => whisperRuntime.getRuntimeStatus(),
    startRuntime: (modelId) => whisperRuntime.startRuntime(modelId),
    stopRuntime: () => whisperRuntime.stopRuntime()
  },
  'local-qwen': {
    listModels: () => qwenRuntime.listModels(),
    downloadModel: (modelId, onProgress) => qwenRuntime.downloadModel(modelId, onProgress),
    cancelDownload: () => qwenRuntime.cancelDownload(),
    deleteModel: (modelId) => qwenRuntime.deleteModel(modelId),
    getRuntimeStatus: () => qwenRuntime.getRuntimeStatus(),
    startRuntime: (modelId) => qwenRuntime.startRuntime(modelId),
    stopRuntime: () => qwenRuntime.stopRuntime()
  }
}

const GLOBAL_LOCAL_DOWNLOAD_LOCK_MESSAGE =
  'Another local model download is already in progress. Wait for it to finish or cancel it first.'
const LOCAL_MODEL_MUTATION_LOCK_MESSAGE =
  'A local model change is already in progress. Wait for it to finish or cancel the download first.'
const NO_DOWNLOADED_MODEL_REPLACEMENT_MESSAGE =
  'Download and select another local model before deleting the active model.'

const isLocalProviderId = (
  providerId: TranscriptionPreferences['providerId']
): providerId is LocalTranscriptionProviderId => {
  return LOCAL_PROVIDER_IDS.has(providerId as LocalTranscriptionProviderId)
}

export class TranscriptionService extends InitializableComponent {
  private readonly preferencesManager: TranscriptionPreferencesManager
  private readonly storageRepository: StorageRepository
  private readonly providerFactory: TranscriptionProviderFactory
  private readonly localRuntimes: Record<LocalTranscriptionProviderId, LocalRuntimeController>
  private readonly localTranscriptionScheduler = new AsyncSerialScheduler()
  private readonly localModelMutationScheduler = new AsyncSerialScheduler()
  private isShuttingDown = false

  constructor(
    options: {
      settingsRepository?: SettingsRepository
      storageRepository?: StorageRepository
      preferencesManager?: TranscriptionPreferencesManager
      localRuntimes?: Record<LocalTranscriptionProviderId, LocalRuntimeController>
    } = {}
  ) {
    super('TranscriptionService')
    const settingsRepository = options.settingsRepository ?? new SettingsRepository()
    this.storageRepository = options.storageRepository ?? new StorageRepository()

    this.preferencesManager =
      options.preferencesManager ?? new TranscriptionPreferencesManager(settingsRepository)
    this.providerFactory = new TranscriptionProviderFactory()
    this.localRuntimes = options.localRuntimes ?? DEFAULT_LOCAL_RUNTIMES
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    await this.preferencesManager.initialize()
    this.isShuttingDown = false
    this.initialized = true
    this.warmPreferencesInBackground(this.preferencesManager.get())
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true
    await this.localTranscriptionScheduler.run(() => this.stopAllLocalRuntimesNow())

    this.initialized = false
  }

  getPreferences(): TranscriptionPreferencesResponse {
    this.assertInitialized()
    const preferences = this.preferencesManager.get()

    return {
      preferences,
      config: this.providerFactory.buildConfig(preferences)
    }
  }

  async updatePreferences(
    params: TranscriptionPreferencesUpdateInput
  ): Promise<TranscriptionPreferencesResponse> {
    this.assertInitialized()
    const previousPreferences = this.preferencesManager.get()
    const preferences = await this.preferencesManager.update(params)

    if (this.shouldStopLocalRuntime(previousPreferences, preferences)) {
      await this.localTranscriptionScheduler.run(() => this.stopAllLocalRuntimesNow())
    }

    this.warmPreferencesInBackground(preferences)

    return {
      preferences,
      config: this.providerFactory.buildConfig(preferences)
    }
  }

  private shouldStopLocalRuntime(
    previousPreferences: TranscriptionPreferences,
    nextPreferences: TranscriptionPreferences
  ): boolean {
    const previousWasLocal = isLocalProviderId(previousPreferences.providerId)
    if (!previousWasLocal) {
      return false
    }

    const switchedAwayFromLocal = nextPreferences.providerId !== previousPreferences.providerId
    const switchedLocalModel = nextPreferences.modelId !== previousPreferences.modelId
    return switchedAwayFromLocal || switchedLocalModel
  }

  private async stopAllLocalRuntimesNow(): Promise<void> {
    const stopResults = await Promise.allSettled([
      ...[...LOCAL_PROVIDER_IDS].map((providerId) => this.getLocalRuntime(providerId).stopRuntime())
    ])

    for (const result of stopResults) {
      if (result.status === 'rejected') {
        console.error('[transcription] failed to stop local runtime during shutdown', result.reason)
      }
    }
  }

  private getLocalRuntime(providerId: LocalTranscriptionProviderId): LocalRuntimeController {
    return this.localRuntimes[providerId]
  }

  async listLocalModels(params: LocalProviderActionInput): Promise<ListLocalModelsResponse> {
    return this.getLocalRuntime(params.providerId).listModels()
  }

  async downloadLocalModel(
    params: LocalModelActionInput,
    onProgress?: (progress: LocalModelDownloadProgress) => void
  ): Promise<LocalModelActionResponse> {
    if (this.localModelMutationScheduler.isBusy()) {
      return { ok: false, message: GLOBAL_LOCAL_DOWNLOAD_LOCK_MESSAGE }
    }

    return await this.localModelMutationScheduler.run(async () => {
      const response = await this.getLocalRuntime(params.providerId).downloadModel(
        params.modelId,
        onProgress
          ? (progress) => {
              onProgress({
                ...progress,
                providerId: params.providerId
              })
            }
          : undefined
      )
      if (response.ok) {
        const preferences = this.preferencesManager.get()
        if (
          preferences.providerId === params.providerId &&
          preferences.modelId === params.modelId
        ) {
          this.warmPreferencesInBackground(preferences)
        }
      }
      return response
    })
  }

  cancelLocalModelDownload(params: LocalProviderActionInput): LocalModelActionResponse {
    return this.getLocalRuntime(params.providerId).cancelDownload()
  }

  async deleteLocalModel(params: LocalModelActionInput): Promise<LocalModelActionResponse> {
    const preferences = this.preferencesManager.get()
    const isDeletingActiveModel =
      preferences.providerId === params.providerId && preferences.modelId === params.modelId

    if (this.localModelMutationScheduler.isBusy()) {
      return { ok: false, message: LOCAL_MODEL_MUTATION_LOCK_MESSAGE }
    }

    return await this.localModelMutationScheduler.run(async () => {
      const replacement = isDeletingActiveModel
        ? await this.findDownloadedReplacement(params)
        : null
      if (isDeletingActiveModel && !replacement) {
        return { ok: false, message: NO_DOWNLOADED_MODEL_REPLACEMENT_MESSAGE }
      }

      if (replacement) {
        try {
          await this.updatePreferences({
            providerId: replacement.providerId,
            modelId: replacement.modelId
          })
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to select a replacement before deleting the active model.'
          return { ok: false, message }
        }
      }

      const response = await this.localTranscriptionScheduler.run(() =>
        this.getLocalRuntime(params.providerId).deleteModel(params.modelId)
      )
      if (!response.ok || !replacement) {
        return response
      }

      this.warmPreferencesInBackground(this.preferencesManager.get())
      return response
    })
  }

  getLocalRuntimeStatus(params: LocalProviderActionInput): LocalRuntimeStatusResponse {
    return this.getLocalRuntime(params.providerId).getRuntimeStatus()
  }

  async startLocalRuntime(params: LocalModelActionInput): Promise<LocalModelActionResponse> {
    return this.localTranscriptionScheduler.run(() =>
      this.getLocalRuntime(params.providerId).startRuntime(params.modelId)
    )
  }

  async stopLocalRuntime(params: LocalProviderActionInput): Promise<LocalModelActionResponse> {
    return this.localTranscriptionScheduler.run(() =>
      this.getLocalRuntime(params.providerId).stopRuntime()
    )
  }

  async transcribeArtifact(artifact: RecordingArtifact): Promise<TranscriptionResult> {
    this.assertInitialized()

    const result = await this.transcribeWithPreferences(artifact, this.preferencesManager.get())

    if (!result.ok) {
      return result
    }

    try {
      const persisted = await this.storageRepository.createSessionWithTranscriptAndMetrics(
        {
          startedAt: artifact.startedAt,
          durationMs: artifact.durationMs ?? null,
          title: null,
          source: `recording:${artifact.sessionId}`
        },
        {
          createdAt: Date.now(),
          text: result.transcript.text,
          language: result.transcript.language ?? null,
          confidence: result.transcript.confidence ?? null,
          durationMs: result.transcript.durationMs ?? artifact.durationMs ?? null
        }
      )

      const transcriptAddedEvent: TranscriptAddedEvent = {
        transcriptId: persisted.transcriptId,
        sessionId: persisted.sessionId,
        createdAt: Date.now()
      }
      emitTranscriptAddedEvent(transcriptAddedEvent)

      return result
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to persist transcription to database.'

      return {
        ok: false,
        code: 'storage_failed',
        message
      }
    }
  }

  async transcribeLocalFile(
    filePath: string,
    sessionId: string,
    preferences: TranscriptionPreferences
  ): Promise<TranscriptionResult> {
    this.assertInitialized()

    if (!isLocalProviderId(preferences.providerId)) {
      return {
        ok: false,
        code: 'provider_not_supported',
        message: 'Meetings require an active local transcription model.'
      }
    }

    return await this.transcribeWithPreferences(
      {
        sessionId,
        filePath
      },
      preferences
    )
  }

  private transcribeWithPreferences(
    artifact: TranscriptionArtifact,
    preferences: TranscriptionPreferences
  ): Promise<TranscriptionResult> {
    const transcribe = (): Promise<TranscriptionResult> =>
      this.providerFactory.transcribe(artifact, preferences)

    return isLocalProviderId(preferences.providerId)
      ? this.localTranscriptionScheduler.run(transcribe)
      : transcribe()
  }

  /** Warm a downloaded selected model without delaying settings updates or startup. */
  private warmPreferencesInBackground(preferences: TranscriptionPreferences): void {
    if (this.isShuttingDown || !isLocalProviderId(preferences.providerId)) {
      return
    }

    const runtime = this.getLocalRuntime(preferences.providerId)
    // Do not submit warm-up to the foreground transcription queue. Switching
    // models or quitting stops hosts through that queue, which interrupts this
    // best-effort work instead of waiting for a cold model to finish loading.
    void runtime
      .startRuntime(preferences.modelId)
      .then((result) => {
        if (!result.ok) {
          console.debug('[transcription] selected local model was not warmed', result.message)
        }
      })
      .catch((error) => {
        console.debug('[transcription] failed to warm selected local model', error)
      })
  }

  /** Finds a usable installed model before an active model can be removed. */
  private async findDownloadedReplacement(
    deleting: LocalModelActionInput
  ): Promise<{ providerId: LocalTranscriptionProviderId; modelId: string } | null> {
    const defaultProviderId = resolveDefaultTranscriptionProviderId()
    const preferredProviderIds = [deleting.providerId, defaultProviderId, ...LOCAL_PROVIDER_IDS]
    const providerIds = [...new Set(preferredProviderIds)]

    for (const providerId of providerIds) {
      const runtime = this.getLocalRuntime(providerId)
      if (!runtime.getRuntimeStatus().status.platformSupported) {
        continue
      }
      const { models } = await runtime.listModels()
      const replacement = models.find(
        (model) =>
          model.downloaded && !(providerId === deleting.providerId && model.id === deleting.modelId)
      )
      if (replacement) {
        return { providerId, modelId: replacement.id }
      }
    }

    return null
  }
}
