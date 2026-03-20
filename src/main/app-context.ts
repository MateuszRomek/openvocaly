import { DictationPasteService } from './paste/service'
import { createOnboardingIpcModule } from './onboarding/ipc'
import { OnboardingService } from './onboarding/service'
import { createPermissionsIpcModule } from './permissions/ipc'
import { PermissionsService } from './permissions/service'
import { DictationPipelineOrchestrator } from './pipeline/dictation-pipeline-orchestrator'
import { DictationIdleResetController } from './pipeline/idle-reset-controller'
import { DictationOverlayPublisher } from './pipeline/overlay-publisher'
import { DictationSessionStateManager } from './pipeline/session'
import { DictationTranscriptionWorkflow } from './pipeline/transcription-workflow'
import { createPipelineIpcModule } from './pipeline/ipc'
import { createRecordingIpcModule } from './recording/ipc'
import { RecordingArtifactBus } from './recording/artifact-bus'
import { RecordingCommandBus } from './recording/command-bus'
import { RecordingPreferencesManager } from './recording/service/preferences-manager'
import { RecordingServiceOrchestrator } from './recording/service/orchestrator'
import { RecordingSessionBus } from './recording/session-bus'
import { RecordingOverlayController } from './overlay/controller'
import { createReportingIpcModule } from './reporting/ipc'
import { ReportingService } from './reporting/service'
import { DatabaseLifecycle } from './repositories/database-lifecycle'
import { SettingsRepository } from './repositories/settings-repository'
import { ShortcutBindingsRepository } from './repositories/shortcut-bindings-repository'
import { StorageRepository } from './repositories/storage-repository'
import { createShortcutsIpcModule } from './shortcuts/ipc'
import { createRecordingShortcutEventEmitter } from './shortcuts/recording-events'
import { ShortcutService } from './shortcuts/service'
import { createStorageIpcModule } from './storage'
import { createTranscriptionIpcModule } from './transcription/ipc'
import { TranscriptionService } from './transcription/service'

export type MainAppContext = {
  services: {
    permissionsService: PermissionsService
    onboardingService: OnboardingService
    recordingService: RecordingServiceOrchestrator
    transcriptionService: TranscriptionService
    reportingService: ReportingService
    shortcutService: ShortcutService
    pipelineOrchestrator: DictationPipelineOrchestrator
    pasteService: DictationPasteService
  }
  buses: {
    recordingCommandBus: RecordingCommandBus
    recordingArtifactBus: RecordingArtifactBus
    recordingSessionBus: RecordingSessionBus
  }
  ipc: {
    storageIpc: ReturnType<typeof createStorageIpcModule>
    onboardingIpc: ReturnType<typeof createOnboardingIpcModule>
    permissionsIpc: ReturnType<typeof createPermissionsIpcModule>
    shortcutsIpc: ReturnType<typeof createShortcutsIpcModule>
    recordingIpc: ReturnType<typeof createRecordingIpcModule>
    transcriptionIpc: ReturnType<typeof createTranscriptionIpcModule>
    reportingIpc: ReturnType<typeof createReportingIpcModule>
    pipelineIpc: ReturnType<typeof createPipelineIpcModule>
  }
  repositories: {
    databaseLifecycle: DatabaseLifecycle
    settingsRepository: SettingsRepository
    shortcutBindingsRepository: ShortcutBindingsRepository
    storageRepository: StorageRepository
  }
}

export const createMainAppContext = (): MainAppContext => {
  const databaseLifecycle = new DatabaseLifecycle()
  const settingsRepository = new SettingsRepository()
  const shortcutBindingsRepository = new ShortcutBindingsRepository()
  const storageRepository = new StorageRepository()

  const permissionsService = new PermissionsService()
  const onboardingService = new OnboardingService(settingsRepository)
  const recordingCommandBus = new RecordingCommandBus()
  const recordingArtifactBus = new RecordingArtifactBus()
  const recordingSessionBus = new RecordingSessionBus()

  const recordingService = new RecordingServiceOrchestrator(
    {
      permissionsService,
      artifactBus: recordingArtifactBus,
      sessionBus: recordingSessionBus
    },
    {
      preferencesManager: new RecordingPreferencesManager(settingsRepository)
    }
  )
  const transcriptionService = new TranscriptionService({
    settingsRepository,
    storageRepository
  })
  const reportingService = new ReportingService()
  const pasteService = new DictationPasteService(permissionsService)

  const overlayController = new RecordingOverlayController()
  const overlayPublisher = new DictationOverlayPublisher(overlayController)
  const session = new DictationSessionStateManager()
  const idleReset = new DictationIdleResetController()
  const transcriptionWorkflow = new DictationTranscriptionWorkflow({
    recordingService,
    transcriptionService
  })
  const pipelineOrchestrator = new DictationPipelineOrchestrator({
    commandBus: recordingCommandBus,
    sessionBus: recordingSessionBus,
    artifactBus: recordingArtifactBus,
    recordingService,
    overlayPublisher,
    session,
    idleReset,
    transcriptionWorkflow,
    pasteService,
    storageRepository
  })
  const shortcutService = new ShortcutService({
    permissionsService,
    emitRecordingShortcutEvent: createRecordingShortcutEventEmitter(recordingCommandBus),
    onPasteLastTranscriptionShortcut: () => {
      void pipelineOrchestrator.triggerPasteLastTranscription().catch((error) => {
        console.error('[shortcuts] paste-last shortcut handler failed', error)
      })
    },
    shortcutBindingsRepository
  })

  const storageIpc = createStorageIpcModule(storageRepository)
  const onboardingIpc = createOnboardingIpcModule(onboardingService)
  const permissionsIpc = createPermissionsIpcModule(permissionsService)
  const shortcutsIpc = createShortcutsIpcModule(shortcutService)
  const recordingIpc = createRecordingIpcModule(recordingService)
  const transcriptionIpc = createTranscriptionIpcModule(transcriptionService)
  const reportingIpc = createReportingIpcModule(reportingService)
  const pipelineIpc = createPipelineIpcModule(pipelineOrchestrator)

  return {
    services: {
      permissionsService,
      onboardingService,
      recordingService,
      transcriptionService,
      reportingService,
      shortcutService,
      pipelineOrchestrator,
      pasteService
    },
    buses: {
      recordingCommandBus,
      recordingArtifactBus,
      recordingSessionBus
    },
    ipc: {
      storageIpc,
      onboardingIpc,
      permissionsIpc,
      shortcutsIpc,
      recordingIpc,
      transcriptionIpc,
      reportingIpc,
      pipelineIpc
    },
    repositories: {
      databaseLifecycle,
      settingsRepository,
      shortcutBindingsRepository,
      storageRepository
    }
  }
}
