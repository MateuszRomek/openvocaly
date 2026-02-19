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
  ShortcutUpdateInput
} from '../shared/shortcuts'

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
    update: (input: ShortcutUpdateInput): Promise<ShortcutMutationResponse> =>
      ipcRenderer.invoke('shortcuts:update', input),
    reset: (input?: ShortcutResetInput): Promise<ShortcutMutationResponse> =>
      ipcRenderer.invoke('shortcuts:reset', input)
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
