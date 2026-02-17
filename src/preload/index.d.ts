import { ElectronAPI } from '@electron-toolkit/preload'
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

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      storage: {
        createSession: (input: CreateSessionInput) => Promise<CreateSessionResult>
        addTranscript: (input: AddTranscriptInput) => Promise<AddTranscriptResult>
        listTranscripts: (input?: ListTranscriptsInput) => Promise<ListTranscriptsResult>
        listSessions: (input?: ListSessionsInput) => Promise<ListSessionsResult>
      }
    }
  }
}
