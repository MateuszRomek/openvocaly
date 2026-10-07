import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
  app: { getPath: () => '/tmp/openvocaly-test' },
  ipcMain: { handle: () => undefined }
}))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))

import type { RecordingArtifact } from '../../../shared/recording'
import type { TranscriptionResult } from '../../../shared/transcription'
import type { StorageRepository } from '../../repositories/storage-repository'
import { TranscriptionService } from './index'
import type { TranscriptionPreferencesManager } from './preferences-manager'

const artifact: RecordingArtifact = {
  sessionId: 'session-1',
  mode: 'push_to_talk',
  format: 'webm_opus',
  filePath: '/recordings/session-1.webm',
  startedAt: 1,
  stoppedAt: 2,
  durationMs: 1
}

describe('TranscriptionService.transcribeArtifact persistence', () => {
  it('still returns the transcript when saving it to the database fails', async () => {
    const service = new TranscriptionService({
      preferencesManager: {
        initialize: async (): Promise<void> => undefined,
        get: () => ({ providerId: 'local-qwen', modelId: 'm' })
      } as unknown as TranscriptionPreferencesManager,
      storageRepository: {
        createSessionWithTranscriptAndMetrics: async () => {
          throw new Error('SQLITE_FULL')
        }
      } as unknown as StorageRepository
    })
    await service.initialize()
    const transcript: TranscriptionResult = { ok: true, transcript: { text: 'hello world' } }
    vi.spyOn(
      service as unknown as { transcribeWithPreferences: () => Promise<TranscriptionResult> },
      'transcribeWithPreferences'
    ).mockResolvedValue(transcript)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(service.transcribeArtifact(artifact)).resolves.toEqual(transcript)
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('failed to persist transcript'),
      expect.objectContaining({ sessionId: 'session-1' })
    )
    consoleError.mockRestore()
  })
})
