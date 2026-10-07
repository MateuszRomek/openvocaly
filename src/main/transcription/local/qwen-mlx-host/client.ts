import { JsonLineHostClient, type HostReply } from '../json-line-host-client'
import { resolveQwenMlxHostPath } from './runtime-discovery'

type QwenMlxHostReply = HostReply & {
  text?: string
  language?: string
  durationMs?: number
}

export type QwenMlxHostTranscription = {
  text: string
  language?: string
  durationMs?: number
}

const WARM_TIMEOUT_MS = 3 * 60 * 1000
const TRANSCRIBE_TIMEOUT_MS = 60 * 60 * 1000

export class QwenMlxHostClient {
  private readonly host = new JsonLineHostClient<QwenMlxHostReply>({
    label: 'Qwen MLX host',
    resolveBinaryPath: resolveQwenMlxHostPath,
    missingBinaryMessage: 'The Qwen MLX host is unavailable. Reinstall the app.'
  })

  isAvailable(): boolean {
    return this.host.isAvailable()
  }

  isRunning(): boolean {
    return this.host.isRunning()
  }

  async warm(modelDirectory: string): Promise<void> {
    await this.host.request('warm', { modelDirectory }, { timeoutMs: WARM_TIMEOUT_MS })
  }

  async transcribe(
    modelDirectory: string,
    filePath: string,
    signal?: AbortSignal
  ): Promise<QwenMlxHostTranscription> {
    const response = await this.host.request(
      'transcribe',
      { modelDirectory, filePath },
      { timeoutMs: TRANSCRIBE_TIMEOUT_MS, signal }
    )
    return {
      text: response.text?.trim() ?? '',
      language: response.language,
      durationMs: response.durationMs
    }
  }

  async stop(): Promise<void> {
    await this.host.stop()
  }
}
