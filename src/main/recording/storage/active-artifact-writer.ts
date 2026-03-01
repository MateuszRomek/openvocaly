import { createWriteStream } from 'node:fs'
import type {
  RecordingArtifact,
  RecordingMode,
  RecordingOutputFormat
} from '../../../shared/recording'

/**
 * Serializes writes to one active recording artifact and owns stream lifecycle
 * until finalize/abort.
 */
export class ActiveArtifactWriter {
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
