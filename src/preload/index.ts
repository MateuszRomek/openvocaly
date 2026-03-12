import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AddTranscriptInput,
  AddTranscriptResult,
  CreateSessionInput,
  CreateSessionResult,
  ListSessionsInput,
  ListSessionsResult,
  ListTranscriptsInput,
  ListTranscriptsResult,
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
  GetHomeRecentSessionsParams,
  GetHomeRecentSessionsResponse,
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
  LocalRuntimeStatusResponse
} from '../shared/local-transcription'
import type {
  AccessibilityRequestResponse,
  MicrophoneRequestResponse,
  OpenSystemSettingsResponse,
  PermissionsStatusResponse
} from '../shared/permissions'

type DesktopPlatform = 'darwin' | 'win32' | 'linux'

const platform: DesktopPlatform =
  process.platform === 'darwin' || process.platform === 'win32' ? process.platform : 'linux'

// Wraps electron IPC event wiring and returns an unsubscribe function for renderer cleanup.
const subscribeToIpcChannel = <TPayload>(
  channel: string,
  callback: (payload: TPayload) => void
): (() => void) => {
  const listener = (_event: IpcRendererEvent, payload: TPayload): void => {
    callback(payload)
  }

  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

// Custom APIs for renderer
const api = {
  system: {
    platform
  },
  storage: {
    createSession: (input: CreateSessionInput): Promise<CreateSessionResult> =>
      ipcRenderer.invoke('storage:createSession', input),
    addTranscript: (input: AddTranscriptInput): Promise<AddTranscriptResult> =>
      ipcRenderer.invoke('storage:addTranscript', input),
    listTranscripts: (input?: ListTranscriptsInput): Promise<ListTranscriptsResult> =>
      ipcRenderer.invoke('storage:listTranscripts', input),
    listSessions: (input?: ListSessionsInput): Promise<ListSessionsResult> =>
      ipcRenderer.invoke('storage:listSessions', input),
    resolveAppIcon: (input?: ResolveAppIconInput): Promise<ResolveAppIconResult> =>
      ipcRenderer.invoke('storage:resolveAppIcon', input)
  },
  reporting: {
    getHomeSummary: (params: GetHomeSummaryParams): Promise<GetHomeSummaryResponse> =>
      ipcRenderer.invoke('reporting:getHomeSummary', params),
    getHomeRangeTimelines: (
      params: GetHomeRangeTimelinesParams
    ): Promise<GetHomeRangeTimelinesResponse> =>
      ipcRenderer.invoke('reporting:getHomeRangeTimelines', params),
    getHomeMonthlyOutput: (
      params: GetHomeMonthlyOutputParams
    ): Promise<GetHomeMonthlyOutputResponse> =>
      ipcRenderer.invoke('reporting:getHomeMonthlyOutput', params),
    getHomeApps: (params: GetHomeAppsParams): Promise<GetHomeAppsResponse> =>
      ipcRenderer.invoke('reporting:getHomeApps', params),
    getHomeRecentSessions: (
      params: GetHomeRecentSessionsParams
    ): Promise<GetHomeRecentSessionsResponse> =>
      ipcRenderer.invoke('reporting:getHomeRecentSessions', params)
  },
  shortcuts: {
    getConfig: (): Promise<ShortcutConfigResponse> => ipcRenderer.invoke('shortcuts:getConfig'),
    getRuntimeStatus: (): Promise<ShortcutRuntimeStatusResponse> =>
      ipcRenderer.invoke('shortcuts:getRuntimeStatus'),
    update: (input: ShortcutUpdateInput): Promise<ShortcutMutationResponse> =>
      ipcRenderer.invoke('shortcuts:update', input),
    reset: (input?: ShortcutResetInput): Promise<ShortcutMutationResponse> =>
      ipcRenderer.invoke('shortcuts:reset', input)
  },
  recording: {
    getPreferences: (): Promise<RecordingPreferencesResponse> =>
      ipcRenderer.invoke('recording:getPreferences'),
    updatePreferences: (
      input: RecordingPreferencesUpdateInput
    ): Promise<RecordingPreferencesResponse> =>
      ipcRenderer.invoke('recording:updatePreferences', input)
  },
  transcription: {
    preferences: {
      get: (): Promise<TranscriptionPreferencesResponse> =>
        ipcRenderer.invoke('transcription:getPreferences'),
      update: (
        input: TranscriptionPreferencesUpdateInput
      ): Promise<TranscriptionPreferencesResponse> =>
        ipcRenderer.invoke('transcription:updatePreferences', input)
    },
    cloud: {
      setProviderApiKey: (
        input: TranscriptionProviderApiKeyUpdateInput
      ): Promise<TranscriptionProviderApiKeyMutationResponse> =>
        ipcRenderer.invoke('transcription:setProviderApiKey', input),
      clearProviderApiKey: (
        input: TranscriptionProviderApiKeyClearInput
      ): Promise<TranscriptionProviderApiKeyMutationResponse> =>
        ipcRenderer.invoke('transcription:clearProviderApiKey', input)
    },
    local: {
      listModels: (): Promise<ListLocalModelsResponse> =>
        ipcRenderer.invoke('transcription:listLocalModels'),
      downloadModel: (input: LocalModelActionInput): Promise<LocalModelActionResponse> =>
        ipcRenderer.invoke('transcription:downloadLocalModel', input),
      cancelDownload: (): Promise<LocalModelActionResponse> =>
        ipcRenderer.invoke('transcription:cancelLocalModelDownload'),
      deleteModel: (input: LocalModelActionInput): Promise<LocalModelActionResponse> =>
        ipcRenderer.invoke('transcription:deleteLocalModel', input),
      getRuntimeStatus: (): Promise<LocalRuntimeStatusResponse> =>
        ipcRenderer.invoke('transcription:getLocalRuntimeStatus'),
      startRuntime: (input: LocalModelActionInput): Promise<LocalModelActionResponse> =>
        ipcRenderer.invoke('transcription:startLocalRuntime', input),
      stopRuntime: (): Promise<LocalModelActionResponse> =>
        ipcRenderer.invoke('transcription:stopLocalRuntime'),
      onDownloadProgress: (callback: (payload: LocalModelDownloadProgress) => void): (() => void) =>
        subscribeToIpcChannel<LocalModelDownloadProgress>(
          'transcription:localModelDownloadProgress',
          callback
        )
    }
  },
  dictation: {
    getRuntimeState: (): Promise<DictationRuntimeStateResponse> =>
      ipcRenderer.invoke('dictation:getRuntimeState')
  },
  permissions: {
    getStatus: (): Promise<PermissionsStatusResponse> =>
      ipcRenderer.invoke('permissions:getStatus'),
    requestAccessibility: (): Promise<AccessibilityRequestResponse> =>
      ipcRenderer.invoke('permissions:requestAccessibility'),
    requestMicrophone: (): Promise<MicrophoneRequestResponse> =>
      ipcRenderer.invoke('permissions:requestMicrophone'),
    openAccessibilitySettings: (): Promise<OpenSystemSettingsResponse> =>
      ipcRenderer.invoke('permissions:openAccessibilitySettings'),
    openMicrophoneSettings: (): Promise<OpenSystemSettingsResponse> =>
      ipcRenderer.invoke('permissions:openMicrophoneSettings')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
