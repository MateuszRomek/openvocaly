import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { app } from 'electron'
import { createUuid } from '../../helpers/id'
import type {
  RecordingArtifact,
  RecordingFailureMetadata,
  RecordingFailureReason,
  RecordingMode,
  RecordingOutputFormat
} from '../../../shared/recording'

const RECORDINGS_ROOT_DIR = 'recordings'
const ACTIVE_DIR = 'active'
const FAILED_DIR = 'failed'
const FAILED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

type ArtifactPaths = {
  rootDir: string
  activeDir: string
  failedDir: string
}

export type ActiveArtifact = {
  artifact: RecordingArtifact
  writeChunk: (chunk: Uint8Array) => Promise<void>
  finalize: (durationMs: number) => Promise<RecordingArtifact>
  abort: () => Promise<void>
}

const resolveArtifactPaths = (): ArtifactPaths => {
  const rootDir = join(app.getPath('userData'), RECORDINGS_ROOT_DIR)

  return {
    rootDir,
    activeDir: join(rootDir, ACTIVE_DIR),
    failedDir: join(rootDir, FAILED_DIR)
  }
}

/**
 * Serializes writes to a single active recording artifact and owns stream
 * lifecycle until finalize/abort is called.
 */
class ActiveArtifactWriter {
  private readonly artifact: RecordingArtifact
  private readonly stream: ReturnType<typeof createWriteStream>

  private chain = Promise.resolve()
  private closed = false
  private streamError: Error | null = null

  constructor(
    private readonly filePath: string,
    sessionId: string,
    mode: RecordingMode,
    format: RecordingOutputFormat,
    private readonly startedAt: number
  ) {
    this.stream = createWriteStream(this.filePath, {
      flags: 'w'
    })
    this.stream.on('error', (error) => {
      this.streamError = error
    })

    this.artifact = {
      sessionId,
      mode,
      format,
      filePath: this.filePath,
      startedAt: this.startedAt
    }
  }

  getArtifact(): RecordingArtifact {
    return this.artifact
  }

  writeChunk(chunk: Uint8Array): Promise<void> {
    if (this.closed) {
      return Promise.resolve()
    }

    if (this.streamError) {
      return Promise.reject(this.streamError)
    }

    this.chain = this.chain.then(async () => {
      if (this.streamError) {
        throw this.streamError
      }

      await new Promise<void>((resolve, reject) => {
        this.stream.write(Buffer.from(chunk), (error) => {
          if (error) {
            this.streamError = error
            reject(error)
            return
          }

          resolve()
        })
      })
    })

    return this.chain
  }

  async finalize(durationMs: number): Promise<RecordingArtifact> {
    if (this.closed) {
      return {
        ...this.artifact,
        stoppedAt: Date.now(),
        durationMs
      }
    }

    await this.chain

    if (this.streamError) {
      throw this.streamError
    }

    await new Promise<void>((resolve, reject) => {
      this.stream.end((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })

    this.closed = true

    return {
      ...this.artifact,
      stoppedAt: Date.now(),
      durationMs
    }
  }

  async abort(): Promise<void> {
    if (this.closed) {
      return
    }

    this.closed = true

    await this.chain.catch(() => undefined)

    await new Promise<void>((resolve) => {
      this.stream.end(() => {
        if (!this.stream.destroyed) {
          this.stream.destroy()
        }
        resolve()
      })
    })

    if (!this.stream.destroyed) {
      this.stream.destroy()
    }
  }
}

const metadataPathForSession = (failedDir: string, sessionId: string): string =>
  join(failedDir, `${sessionId}.json`)

const toFailedAudioPath = (failedDir: string, sessionId: string): string =>
  join(failedDir, `${sessionId}.webm`)

const isOldEnoughToDelete = (timestamp: number, now: number): boolean =>
  now - timestamp > FAILED_RETENTION_MS

const isMissingFileError = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')

/**
 * Persists active capture artifacts and failure metadata under userData/recordings.
 *
 * Retention policy:
 * - Active artifacts are temporary and either finalized or promoted to failed.
 * - Failed metadata/audio older than FAILED_RETENTION_MS are cleaned up.
 */
export class RecordingArtifactStore {
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
    failureReason: RecordingFailureReason,
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
