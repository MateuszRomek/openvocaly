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
import { parakeetRuntime } from '../local/parakeet/runtime'
import { whisperRuntime } from '../local/whisper/runtime'
import {
  resolveDefaultTranscriptionModelId,
  resolveDefaultTranscriptionProviderId
} from '../provider-helpers'
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
  'local-whisper'
])

const LOCAL_RUNTIMES: Record<LocalTranscriptionProviderId, LocalRuntimeController> = {
  'local-parakeet': {
    listModels: () => parakeetRuntime.listModels(),
    downloadModel: (modelId, onProgress) => parakeetRuntime.downloadModel(modelId, onProgress),
    cancelDownload: () => parakeetRuntime.cancelDownload(),
    deleteModel: (modelId) => parakeetRuntime.deleteModel(modelId),
    getRuntimeStatus: () => parakeetRuntime.getRuntimeStatus(),
    startRuntime: (modelId) => parakeetRuntime.startRuntime(modelId),
    stopRuntime: () => parakeetRuntime.stopRuntime()
  },
  'local-whisper': {
    listModels: () => whisperRuntime.listModels(),
    downloadModel: (modelId, onProgress) => whisperRuntime.downloadModel(modelId, onProgress),
    cancelDownload: () => whisperRuntime.cancelDownload(),
    deleteModel: (modelId) => whisperRuntime.deleteModel(modelId),
    getRuntimeStatus: () => whisperRuntime.getRuntimeStatus(),
    startRuntime: (modelId) => whisperRuntime.startRuntime(modelId),
    stopRuntime: () => whisperRuntime.stopRuntime()
  }
}

const GLOBAL_LOCAL_DOWNLOAD_LOCK_MESSAGE =
  'Another local model download is already in progress. Wait for it to finish or cancel it first.'

const isLocalProviderId = (
  providerId: TranscriptionPreferences['providerId']
): providerId is LocalTranscriptionProviderId => {
  return LOCAL_PROVIDER_IDS.has(providerId as LocalTranscriptionProviderId)
}

export class TranscriptionService extends InitializableComponent {
  private readonly preferencesManager: TranscriptionPreferencesManager
  private readonly storageRepository: StorageRepository
  private readonly providerFactory: TranscriptionProviderFactory
  private readonly localTranscriptionScheduler = new AsyncSerialScheduler()
  private activeDownloadProviderId: LocalTranscriptionProviderId | null = null

  constructor(
    options: {
      settingsRepository?: SettingsRepository
      storageRepository?: StorageRepository
      preferencesManager?: TranscriptionPreferencesManager
    } = {}
  ) {
    super('TranscriptionService')
    const settingsRepository = options.settingsRepository ?? new SettingsRepository()
    this.storageRepository = options.storageRepository ?? new StorageRepository()

    this.preferencesManager =
      options.preferencesManager ?? new TranscriptionPreferencesManager(settingsRepository)
    this.providerFactory = new TranscriptionProviderFactory()
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    await this.preferencesManager.initialize()
    this.initialized = true
  }

  async shutdown(): Promise<void> {
    await this.stopAllLocalRuntimesNow()

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
      parakeetRuntime.stopRuntime(),
      whisperRuntime.stopRuntime()
    ])

    for (const result of stopResults) {
      if (result.status === 'rejected') {
        console.error('[transcription] failed to stop local runtime during shutdown', result.reason)
      }
    }
  }

  private getLocalRuntime(providerId: LocalTranscriptionProviderId): LocalRuntimeController {
    return LOCAL_RUNTIMES[providerId]
  }

  async listLocalModels(params: LocalProviderActionInput): Promise<ListLocalModelsResponse> {
    return this.getLocalRuntime(params.providerId).listModels()
  }

  async downloadLocalModel(
    params: LocalModelActionInput,
    onProgress?: (progress: LocalModelDownloadProgress) => void
  ): Promise<LocalModelActionResponse> {
    // TODO: Allow to download multiple models simultaneously by tracking active downloads per provider instead of a global lock
    if (this.activeDownloadProviderId) {
      return { ok: false, message: GLOBAL_LOCAL_DOWNLOAD_LOCK_MESSAGE }
    }

    this.activeDownloadProviderId = params.providerId

    try {
      return await this.getLocalRuntime(params.providerId).downloadModel(
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
    } finally {
      this.activeDownloadProviderId = null
    }
  }

  cancelLocalModelDownload(params: LocalProviderActionInput): LocalModelActionResponse {
    return this.getLocalRuntime(params.providerId).cancelDownload()
  }

  async deleteLocalModel(params: LocalModelActionInput): Promise<LocalModelActionResponse> {
    const response = await this.localTranscriptionScheduler.run(() =>
      this.getLocalRuntime(params.providerId).deleteModel(params.modelId)
    )
    if (!response.ok) {
      return response
    }

    const preferences = this.preferencesManager.get()
    const isDeletingActiveModel =
      preferences.providerId === params.providerId && preferences.modelId === params.modelId

    if (!isDeletingActiveModel) {
      return response
    }

    try {
      const fallbackProviderId = resolveDefaultTranscriptionProviderId()
      const fallbackModelId = resolveDefaultTranscriptionModelId(fallbackProviderId)

      await this.updatePreferences({
        providerId: fallbackProviderId,
        modelId: fallbackModelId
      })

      return response
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Deleted local model, but failed to reset active transcription preferences.'

      console.error('[transcription] failed to reset active model after local delete', {
        providerId: params.providerId,
        modelId: params.modelId,
        error: message
      })

      return {
        ok: false,
        message
      }
    }
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
}
