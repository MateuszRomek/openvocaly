import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AddTranscriptInput,
  AddTranscriptResult,
  CreateSessionInput,
  CreateSessionResult,
  ListSessionsInput,
  ListSessionsResult,
  ListTranscriptsInput,
  ListTranscriptsResult,
  SessionTargetAppUpdatedEvent,
  TranscriptAddedEvent,
  ResolveAppIconInput,
  ResolveAppIconResult
} from '../shared/storage'
import type {
  GetHomeAppsParams,
  GetHomeAppsResponse,
  GetHomeMonthlyOutputParams,
  GetHomeMonthlyOutputResponse,
  GetHomeRangeTimelinesParams,
  GetHomeRangeTimelinesResponse,
  GetHomeSummaryParams,
  GetHomeSummaryResponse
} from '../shared/reporting'
import type {
  ShortcutConfigResponse,
  ShortcutMutationResponse,
  ShortcutResetInput,
  ShortcutRuntimeStatusResponse,
  ShortcutUpdateInput
} from '../shared/shortcuts'
import type {
  RecordingPreferencesResponse,
  RecordingPreferencesUpdateInput
} from '../shared/recording'
import type { DictationRuntimeStateResponse } from '../shared/dictation'
import type {
  TranscriptionPreferencesResponse,
  TranscriptionPreferencesUpdateInput,
  TranscriptionProviderApiKeyClearInput,
  TranscriptionProviderApiKeyMutationResponse,
  TranscriptionProviderApiKeyUpdateInput
} from '../shared/transcription'
import type {
  ListLocalModelsResponse,
  LocalModelActionInput,
  LocalModelActionResponse,
  LocalModelDownloadProgress,
  LocalProviderActionInput,
  LocalRuntimeStatusResponse
} from '../shared/local-transcription'
import type {
  AccessibilityRequestResponse,
  MicrophoneRequestResponse,
  OpenSystemSettingsResponse,
  PermissionsStatusResponse
} from '../shared/permissions'
import type { OnboardingMarkCompletedResponse, OnboardingStateResponse } from '../shared/onboarding'
import type {
  GetMeetingInput,
  GetMeetingResponse,
  ImportMeetingResponse,
  ListMeetingsResponse,
  MeetingActionInput,
  MeetingActionResponse
} from '../shared/meetings'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      system: {
        platform: 'darwin' | 'win32' | 'linux'
      }
      storage: {
        createSession: (input: CreateSessionInput) => Promise<CreateSessionResult>
        addTranscript: (input: AddTranscriptInput) => Promise<AddTranscriptResult>
        listTranscripts: (input?: ListTranscriptsInput) => Promise<ListTranscriptsResult>
        listSessions: (input?: ListSessionsInput) => Promise<ListSessionsResult>
        resolveAppIcon: (input?: ResolveAppIconInput) => Promise<ResolveAppIconResult>
        onTranscriptAdded: (callback: (payload: TranscriptAddedEvent) => void) => () => void
        onSessionTargetAppUpdated: (
          callback: (payload: SessionTargetAppUpdatedEvent) => void
        ) => () => void
      }
      reporting: {
        getHomeSummary: (params: GetHomeSummaryParams) => Promise<GetHomeSummaryResponse>
        getHomeRangeTimelines: (
          params: GetHomeRangeTimelinesParams
        ) => Promise<GetHomeRangeTimelinesResponse>
        getHomeMonthlyOutput: (
          params: GetHomeMonthlyOutputParams
        ) => Promise<GetHomeMonthlyOutputResponse>
        getHomeApps: (params: GetHomeAppsParams) => Promise<GetHomeAppsResponse>
      }
      meetings: {
        list: () => Promise<ListMeetingsResponse>
        get: (input: GetMeetingInput) => Promise<GetMeetingResponse>
        selectAndImport: () => Promise<ImportMeetingResponse>
        cancel: (input: MeetingActionInput) => Promise<MeetingActionResponse>
        resume: (input: MeetingActionInput) => Promise<MeetingActionResponse>
        delete: (input: MeetingActionInput) => Promise<MeetingActionResponse>
      }
      shortcuts: {
        getConfig: () => Promise<ShortcutConfigResponse>
        getRuntimeStatus: () => Promise<ShortcutRuntimeStatusResponse>
        startCaptureSession: () => Promise<void>
        stopCaptureSession: () => Promise<void>
        update: (input: ShortcutUpdateInput) => Promise<ShortcutMutationResponse>
        reset: (input?: ShortcutResetInput) => Promise<ShortcutMutationResponse>
      }
      recording: {
        getPreferences: () => Promise<RecordingPreferencesResponse>
        updatePreferences: (
          input: RecordingPreferencesUpdateInput
        ) => Promise<RecordingPreferencesResponse>
      }
      transcription: {
        preferences: {
          get: () => Promise<TranscriptionPreferencesResponse>
          update: (
            input: TranscriptionPreferencesUpdateInput
          ) => Promise<TranscriptionPreferencesResponse>
        }
        cloud: {
          setProviderApiKey: (
            input: TranscriptionProviderApiKeyUpdateInput
          ) => Promise<TranscriptionProviderApiKeyMutationResponse>
          clearProviderApiKey: (
            input: TranscriptionProviderApiKeyClearInput
          ) => Promise<TranscriptionProviderApiKeyMutationResponse>
        }
        local: {
          listModels: (input: LocalProviderActionInput) => Promise<ListLocalModelsResponse>
          downloadModel: (input: LocalModelActionInput) => Promise<LocalModelActionResponse>
          cancelDownload: (input: LocalProviderActionInput) => Promise<LocalModelActionResponse>
          deleteModel: (input: LocalModelActionInput) => Promise<LocalModelActionResponse>
          getRuntimeStatus: (input: LocalProviderActionInput) => Promise<LocalRuntimeStatusResponse>
          startRuntime: (input: LocalModelActionInput) => Promise<LocalModelActionResponse>
          stopRuntime: (input: LocalProviderActionInput) => Promise<LocalModelActionResponse>
          onDownloadProgress: (
            callback: (payload: LocalModelDownloadProgress) => void
          ) => () => void
        }
      }
      dictation: {
        getRuntimeState: () => Promise<DictationRuntimeStateResponse>
      }
      permissions: {
        getStatus: () => Promise<PermissionsStatusResponse>
        requestAccessibility: () => Promise<AccessibilityRequestResponse>
        requestMicrophone: () => Promise<MicrophoneRequestResponse>
        openAccessibilitySettings: () => Promise<OpenSystemSettingsResponse>
        openMicrophoneSettings: () => Promise<OpenSystemSettingsResponse>
      }
      onboarding: {
        getState: () => Promise<OnboardingStateResponse>
        markCompleted: () => Promise<OnboardingMarkCompletedResponse>
      }
    }
  }
}
