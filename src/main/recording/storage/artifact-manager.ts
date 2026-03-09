import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { createUuid } from '../../helpers/id'
import type {
  RecordingArtifact,
  RecordingFailureMetadata,
  RecordingArtifactFailureReason,
  RecordingMode,
  RecordingOutputFormat
} from '../../../shared/recording'
import { ActiveArtifactWriter } from './active-artifact-writer'
import {
  isMissingFileError,
  isOldEnoughToDelete,
  metadataPathForSession,
  resolveArtifactPaths,
  toFailedAudioPath
} from './artifact-manager-helpers'

export type ActiveArtifact = {
  artifact: RecordingArtifact
  writeChunk: (chunk: Uint8Array) => Promise<void>
  finalize: (durationMs: number) => Promise<RecordingArtifact>
  abort: () => Promise<void>
}

/**
 * Persists active capture artifacts and failure metadata under userData/recordings.
 *
 * Retention policy:
 * - Active artifacts are temporary and either finalized or promoted to failed.
 * - Failed metadata/audio older than FAILED_RETENTION_MS are cleaned up.
 */
export class RecordingArtifactManager {
  private readonly paths = resolveArtifactPaths()

  /**
   * Ensures storage directories exist and reconciles leftovers from previous runs.
   */
  async initialize(): Promise<void> {
    await mkdir(this.paths.rootDir, { recursive: true })
    await mkdir(this.paths.activeDir, { recursive: true })
    await mkdir(this.paths.failedDir, { recursive: true })

    await this.promoteStaleActiveArtifacts()
    await this.cleanupExpiredFailures()
  }

  async createActiveArtifact(
    mode: RecordingMode,
    format: RecordingOutputFormat
  ): Promise<ActiveArtifact> {
    await this.ensureDirectories()

    const sessionId = createUuid()
    const startedAt = Date.now()
    const activeFilePath = join(this.paths.activeDir, `${sessionId}.webm`)
    const writer = new ActiveArtifactWriter(activeFilePath, sessionId, mode, format, startedAt)

    return {
      artifact: writer.getArtifact(),
      writeChunk: (chunk) => writer.writeChunk(chunk),
      finalize: (durationMs) => writer.finalize(durationMs),
      abort: () => writer.abort()
    }
  }

  async markTranscriptionSuccess(artifact: RecordingArtifact): Promise<void> {
    await rm(artifact.filePath, { force: true })
  }

  async markFailure(
    artifact: RecordingArtifact,
    failureReason: RecordingArtifactFailureReason,
    message?: string
  ): Promise<RecordingFailureMetadata> {
    await this.ensureDirectories()

    const failedAudioPath = toFailedAudioPath(this.paths.failedDir, artifact.sessionId)

    try {
      await rename(artifact.filePath, failedAudioPath)
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error
      }
    }

    const metadata: RecordingFailureMetadata = {
      ...artifact,
      filePath: failedAudioPath,
      failureReason,
      failedAt: Date.now(),
      message
    }

    await writeFile(
      metadataPathForSession(this.paths.failedDir, artifact.sessionId),
      JSON.stringify(metadata),
      {
        encoding: 'utf8'
      }
    )

    return metadata
  }

  /**
   * Removes expired failed artifacts and metadata.
   * Invalid metadata falls back to file mtime-based cleanup.
   */
  async cleanupExpiredFailures(): Promise<void> {
    await this.ensureDirectories()

    const now = Date.now()
    const entries = await readdir(this.paths.failedDir)

    const metadataEntries = entries.filter((entry) => extname(entry) === '.json')

    for (const entry of metadataEntries) {
      const fullPath = join(this.paths.failedDir, entry)

      try {
        const raw = await readFile(fullPath, 'utf8')
        const metadata = JSON.parse(raw) as Partial<RecordingFailureMetadata>

        if (!metadata.failedAt || !metadata.sessionId) {
          continue
        }

        if (!isOldEnoughToDelete(metadata.failedAt, now)) {
          continue
        }

        await rm(fullPath, { force: true })
        await rm(toFailedAudioPath(this.paths.failedDir, metadata.sessionId), { force: true })
      } catch {
        const fileInfo = await stat(fullPath)

        if (isOldEnoughToDelete(fileInfo.mtimeMs, now)) {
          await rm(fullPath, { force: true })
        }
      }
    }

    const staleAudioEntries = entries.filter((entry) => extname(entry) === '.webm')

    for (const entry of staleAudioEntries) {
      const sessionId = basename(entry, '.webm')
      const metadataPath = metadataPathForSession(this.paths.failedDir, sessionId)

      if (existsSync(metadataPath)) {
        continue
      }

      const audioPath = join(this.paths.failedDir, entry)

      try {
        const info = await stat(audioPath)

        if (isOldEnoughToDelete(info.mtimeMs, now)) {
          await rm(audioPath, { force: true })
        }
      } catch {
        await rm(audioPath, { force: true })
      }
    }
  }

  /**
   * Converts stale active recordings into failed artifacts at startup.
   */
  private async promoteStaleActiveArtifacts(): Promise<void> {
    const entries = await readdir(this.paths.activeDir)

    for (const entry of entries) {
      if (extname(entry) !== '.webm') {
        continue
      }

      const stalePath = join(this.paths.activeDir, entry)
      const sessionId = basename(entry, '.webm')

      let startedAt = Date.now()

      try {
        const fileInfo = await stat(stalePath)
        startedAt = Math.floor(fileInfo.mtimeMs)
      } catch {
        // fallback to current time when file stat is unavailable
      }

      const fallbackArtifact: RecordingArtifact = {
        sessionId,
        mode: 'toggle',
        format: 'webm_opus',
        filePath: stalePath,
        startedAt
      }

      await this.markFailure(
        fallbackArtifact,
        'aborted',
        'Recording was interrupted before completion.'
      )
    }
  }

  private async ensureDirectories(): Promise<void> {
    await mkdir(this.paths.rootDir, { recursive: true })
    await mkdir(this.paths.activeDir, { recursive: true })
    await mkdir(this.paths.failedDir, { recursive: true })
  }
}
