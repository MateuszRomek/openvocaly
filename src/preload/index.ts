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

// Custom APIs for renderer
const api = {
  storage: {
    createSession: (input: CreateSessionInput): Promise<CreateSessionResult> =>
      ipcRenderer.invoke('storage:createSession', input),
    addTranscript: (input: AddTranscriptInput): Promise<AddTranscriptResult> =>
      ipcRenderer.invoke('storage:addTranscript', input),
    listTranscripts: (input?: ListTranscriptsInput): Promise<ListTranscriptsResult> =>
      ipcRenderer.invoke('storage:listTranscripts', input),
    listSessions: (input?: ListSessionsInput): Promise<ListSessionsResult> =>
      ipcRenderer.invoke('storage:listSessions', input)
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
