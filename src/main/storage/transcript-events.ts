import { BrowserWindow } from 'electron'
import { STORAGE_TRANSCRIPT_ADDED_CHANNEL, type TranscriptAddedEvent } from '../../shared/storage'

export const emitTranscriptAddedEvent = (payload: TranscriptAddedEvent): void => {
  for (const appWindow of BrowserWindow.getAllWindows()) {
    if (appWindow.isDestroyed()) {
      continue
    }

    appWindow.webContents.send(STORAGE_TRANSCRIPT_ADDED_CHANNEL, payload)
  }
}
