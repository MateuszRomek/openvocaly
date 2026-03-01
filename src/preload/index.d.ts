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
        getRuntimeStatus: () => Promise<ShortcutRuntimeStatusResponse>
        update: (input: ShortcutUpdateInput) => Promise<ShortcutMutationResponse>
        reset: (input?: ShortcutResetInput) => Promise<ShortcutMutationResponse>
      }
      recording: {
        getRuntimeState: () => Promise<RecordingRuntimeStateResponse>
        getPreferences: () => Promise<RecordingPreferencesResponse>
        updatePreferences: (
          input: RecordingPreferencesUpdateInput
        ) => Promise<RecordingPreferencesResponse>
      }
      permissions: {
        getStatus: () => Promise<PermissionsStatusResponse>
        requestAccessibility: () => Promise<AccessibilityRequestResponse>
        requestMicrophone: () => Promise<MicrophoneRequestResponse>
        openAccessibilitySettings: () => Promise<OpenSystemSettingsResponse>
        openMicrophoneSettings: () => Promise<OpenSystemSettingsResponse>
      }
    }
  }
}
