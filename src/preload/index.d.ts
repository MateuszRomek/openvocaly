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
import type {
  ShortcutConfigResponse,
  ShortcutMutationResponse,
  ShortcutResetInput,
  ShortcutUpdateInput
} from '../shared/shortcuts'

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
      }
      shortcuts: {
        getConfig: () => Promise<ShortcutConfigResponse>
        update: (input: ShortcutUpdateInput) => Promise<ShortcutMutationResponse>
        reset: (input?: ShortcutResetInput) => Promise<ShortcutMutationResponse>
      }
    }
  }
}
