import { app } from 'electron'
import { join } from 'node:path'

const RECORDINGS_ROOT_DIR = 'recordings'
const ACTIVE_DIR = 'active'
const FAILED_DIR = 'failed'
const FAILED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export type ArtifactPaths = {
  rootDir: string
  activeDir: string
  failedDir: string
}

export const resolveArtifactPaths = (): ArtifactPaths => {
  const rootDir = join(app.getPath('userData'), RECORDINGS_ROOT_DIR)

  return {
    rootDir,
    activeDir: join(rootDir, ACTIVE_DIR),
    failedDir: join(rootDir, FAILED_DIR)
  }
}

export const metadataPathForSession = (failedDir: string, sessionId: string): string =>
  join(failedDir, `${sessionId}.json`)

export const toFailedAudioPath = (failedDir: string, sessionId: string): string =>
  join(failedDir, `${sessionId}.webm`)

export const isOldEnoughToDelete = (timestamp: number, now: number): boolean =>
  now - timestamp > FAILED_RETENTION_MS

export const isMissingFileError = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
