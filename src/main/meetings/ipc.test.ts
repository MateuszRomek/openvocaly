import { beforeEach, describe, expect, it, vi } from 'vitest'

const electronMocks = vi.hoisted(() => ({
  handlers: new Map<string, unknown>(),
  showOpenDialog: vi.fn()
}))

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
  app: { getPath: () => '/tmp/openvocaly-meetings-ipc-test' },
  dialog: { showOpenDialog: electronMocks.showOpenDialog },
  ipcMain: {
    handle: (channel: string, handler: unknown): void => {
      electronMocks.handlers.set(channel, handler)
    }
  }
}))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))

import type { ImportMeetingResponse, MeetingImportSelection } from '../../shared/meetings'
import { createMeetingsIpcModule } from './ipc'

type ImportHandler = (
  event: unknown,
  input: MeetingImportSelection
) => Promise<ImportMeetingResponse>

const getImportHandler = (): ImportHandler => {
  const handler = electronMocks.handlers.get('meetings:selectAndImport')
  if (typeof handler !== 'function') {
    throw new Error('Meeting import handler was not registered.')
  }
  return handler as ImportHandler
}

describe('meetings IPC import flow', () => {
  beforeEach(() => {
    electronMocks.handlers.clear()
    electronMocks.showOpenDialog.mockReset()
  })

  it('passes the selected downloaded model to the local import service', async () => {
    const selection: MeetingImportSelection = {
      providerId: 'local-whisper',
      modelId: 'whisper-large-v3-turbo-q5'
    }
    const importFile = vi.fn(
      async (): Promise<ImportMeetingResponse> => ({
        ok: true,
        meeting: {
          id: 'meeting-1',
          title: 'Planning',
          sourceFileName: 'planning.mp3',
          status: 'queued',
          providerId: selection.providerId,
          modelId: selection.modelId,
          createdAt: 1,
          updatedAt: 1,
          durationMs: null,
          completedChunks: 0,
          totalChunks: 0,
          errorMessage: null
        }
      })
    )
    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/recordings/planning.mp3']
    })

    createMeetingsIpcModule({ importFile } as never).registerIpcHandlers()

    await expect(getImportHandler()({}, selection)).resolves.toMatchObject({ ok: true })
    expect(importFile).toHaveBeenCalledWith('/recordings/planning.mp3', selection)
  })

  it('rejects an import without a model before opening the file picker', async () => {
    electronMocks.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [] })
    createMeetingsIpcModule({ importFile: vi.fn() } as never).registerIpcHandlers()

    await expect(
      getImportHandler()({}, { providerId: 'local-whisper', modelId: '' })
    ).rejects.toThrow('Choose an installed local transcription model before importing a meeting.')
    expect(electronMocks.showOpenDialog).not.toHaveBeenCalled()
  })
})
