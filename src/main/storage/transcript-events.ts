import { BrowserWindow } from 'electron'
import {
  STORAGE_SESSION_TARGET_APP_UPDATED_CHANNEL,
  STORAGE_TRANSCRIPT_ADDED_CHANNEL,
  type SessionTargetAppUpdatedEvent,
  type TranscriptAddedEvent
} from '../../shared/storage'

export const emitTranscriptAddedEvent = (payload: TranscriptAddedEvent): void => {
  for (const appWindow of BrowserWindow.getAllWindows()) {
    if (appWindow.isDestroyed()) {
      continue
    }

    appWindow.webContents.send(STORAGE_TRANSCRIPT_ADDED_CHANNEL, payload)
  }
}

export const emitSessionTargetAppUpdatedEvent = (payload: SessionTargetAppUpdatedEvent): void => {
  for (const appWindow of BrowserWindow.getAllWindows()) {
    if (appWindow.isDestroyed()) {
      continue
    }

    appWindow.webContents.send(STORAGE_SESSION_TARGET_APP_UPDATED_CHANNEL, payload)
  }
}
