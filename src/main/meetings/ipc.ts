import { dialog, ipcMain } from 'electron'
import type {
  GetMeetingInput,
  GetMeetingResponse,
  ImportMeetingResponse,
  MeetingImportSelection,
  ListMeetingsResponse,
  MeetingActionInput,
  MeetingActionResponse
} from '../../shared/meetings'
import { createIpcRegistrar } from '../helpers/ipc'
import { isTranscriptionProviderId } from '../transcription/provider-helpers'
import type { MeetingsService } from './service'

export type MeetingsIpcModule = {
  registerIpcHandlers: () => void
  initialize: () => Promise<void>
  shutdown: () => Promise<void>
}

const getMeetingId = (input: GetMeetingInput | MeetingActionInput | undefined): string => {
  const meetingId = input?.meetingId
  if (typeof meetingId !== 'string' || !meetingId.trim()) {
    throw new Error('A valid meeting id is required.')
  }
  return meetingId
}

const getMeetingImportSelection = (input: unknown): MeetingImportSelection => {
  if (
    typeof input !== 'object' ||
    input === null ||
    !isTranscriptionProviderId((input as { providerId?: unknown }).providerId) ||
    typeof (input as { modelId?: unknown }).modelId !== 'string' ||
    !(input as { modelId: string }).modelId.trim()
  ) {
    throw new Error('Choose an installed local transcription model before importing a meeting.')
  }

  return {
    providerId: (input as { providerId: MeetingImportSelection['providerId'] }).providerId,
    modelId: (input as { modelId: string }).modelId
  }
}

export const createMeetingsIpcModule = (meetingsService: MeetingsService): MeetingsIpcModule => {
  const registerIpcHandlers = createIpcRegistrar(() => {
    ipcMain.handle('meetings:list', (): Promise<ListMeetingsResponse> => meetingsService.list())

    ipcMain.handle(
      'meetings:get',
      (_event, input: GetMeetingInput): Promise<GetMeetingResponse> =>
        meetingsService.get(getMeetingId(input))
    )

    ipcMain.handle(
      'meetings:selectAndImport',
      async (_event, input: unknown): Promise<ImportMeetingResponse> => {
        const modelSelection = getMeetingImportSelection(input)
        const fileSelection = await dialog.showOpenDialog({
          title: 'Import a meeting recording',
          buttonLabel: 'Import recording',
          properties: ['openFile'],
          filters: [
            {
              name: 'Audio and video',
              extensions: ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mov', 'ogg', 'wav', 'webm']
            }
          ]
        })

        const selectedPath = fileSelection.filePaths[0]
        if (fileSelection.canceled || !selectedPath) {
          return { ok: false, cancelled: true }
        }

        return await meetingsService.importFile(selectedPath, modelSelection)
      }
    )

    ipcMain.handle(
      'meetings:cancel',
      (_event, input: MeetingActionInput): Promise<MeetingActionResponse> =>
        meetingsService.cancel(getMeetingId(input))
    )

    ipcMain.handle(
      'meetings:resume',
      (_event, input: MeetingActionInput): Promise<MeetingActionResponse> =>
        meetingsService.resume(getMeetingId(input))
    )

    ipcMain.handle(
      'meetings:delete',
      (_event, input: MeetingActionInput): Promise<MeetingActionResponse> =>
        meetingsService.delete(getMeetingId(input))
    )
  })

  return {
    registerIpcHandlers,
    initialize: () => meetingsService.initialize(),
    shutdown: () => meetingsService.shutdown()
  }
}
