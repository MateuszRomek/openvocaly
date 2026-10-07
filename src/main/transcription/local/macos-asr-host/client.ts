import { JsonLineHostClient, type HostReply } from '../json-line-host-client'
import { resolveMacOSAsrHostPath } from './runtime-discovery'

type MacOSAsrHostReply = HostReply & {
  text?: string | null
  confidence?: number | null
  durationMs?: number | null
}

export type MacOSAsrHostTranscription = {
  text: string
  confidence?: number
  durationMs?: number
}

const INSTALL_TIMEOUT_MS = 30 * 60 * 1000
const WARM_TIMEOUT_MS = 90 * 1000
const TRANSCRIBE_TIMEOUT_MS = 60 * 60 * 1000

export class MacOSAsrHostClient {
  private readonly host = new JsonLineHostClient<MacOSAsrHostReply>({
    label: 'macOS ASR host',
    resolveBinaryPath: resolveMacOSAsrHostPath,
    missingBinaryMessage: 'The macOS ASR host binary is unavailable. Reinstall the app.'
  })

  isAvailable(): boolean {
    return this.host.isAvailable()
  }

  isRunning(): boolean {
    return this.host.isRunning()
  }

  async install(modelDirectory: string, onProgress?: (percentage: number) => void): Promise<void> {
    await this.host.request(
      'install',
      { modelDirectory },
      { timeoutMs: INSTALL_TIMEOUT_MS, onProgress }
    )
  }

  async warm(modelDirectory: string): Promise<void> {
    await this.host.request('warm', { modelDirectory }, { timeoutMs: WARM_TIMEOUT_MS })
  }

  async transcribe(
    modelDirectory: string,
    filePath: string,
    signal?: AbortSignal
  ): Promise<MacOSAsrHostTranscription> {
    const response = await this.host.request(
      'transcribe',
      { modelDirectory, filePath },
      { timeoutMs: TRANSCRIBE_TIMEOUT_MS, signal }
    )
    return {
      text: response.text?.trim() ?? '',
      confidence: response.confidence ?? undefined,
      durationMs: response.durationMs ?? undefined
    }
  }

  async stop(): Promise<void> {
    await this.host.stop()
  }
}
