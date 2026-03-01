import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AddTranscriptInput,
  AddTranscriptResult,
  CreateSessionInput,
  CreateSessionResult,
  ListSessionsInput,
  ListSessionsResult,
  ListTranscriptsInput,
  ListTranscriptsResult
} from '../shared/storage'
import type {
  ShortcutConfigResponse,
  ShortcutMutationResponse,
  ShortcutResetInput,
  ShortcutRuntimeStatusResponse,
  ShortcutUpdateInput
} from '../shared/shortcuts'
import type {
  RecordingPreferencesResponse,
  RecordingPreferencesUpdateInput,
  RecordingRuntimeStateResponse
} from '../shared/recording'
import type {
  AccessibilityRequestResponse,
  MicrophoneRequestResponse,
  OpenSystemSettingsResponse,
  PermissionsStatusResponse
} from '../shared/permissions'

type DesktopPlatform = 'darwin' | 'win32' | 'linux'

const platform: DesktopPlatform =
  process.platform === 'darwin' || process.platform === 'win32' ? process.platform : 'linux'

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
      ipcRenderer.invoke('storage:listSessions', input)
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
    getRuntimeState: (): Promise<RecordingRuntimeStateResponse> =>
      ipcRenderer.invoke('recording:getRuntimeState'),
    getPreferences: (): Promise<RecordingPreferencesResponse> =>
      ipcRenderer.invoke('recording:getPreferences'),
    updatePreferences: (
      input: RecordingPreferencesUpdateInput
    ): Promise<RecordingPreferencesResponse> =>
      ipcRenderer.invoke('recording:updatePreferences', input)
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
