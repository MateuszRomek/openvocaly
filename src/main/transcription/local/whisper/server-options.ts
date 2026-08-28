export type WhisperServerLaunchOptions = {
  modelPath: string
  port: number
  threads?: number
  gpuEnabled?: boolean
}

/**
 * Keep Whisper's CPU-side work bounded on Apple Silicon. The local Turbo Q5
 * benchmark showed equivalent warm latency at two and four threads with Metal
 * enabled, so two is the safer sustained-dictation default.
 */
const CURRENT_DEFAULT_THREADS = 2

/**
 * Builds the complete whisper.cpp server invocation in one place so its
 * performance policy is explicit and independently testable.
 */
export const buildWhisperServerArgs = ({
  modelPath,
  port,
  threads = CURRENT_DEFAULT_THREADS,
  gpuEnabled = true
}: WhisperServerLaunchOptions): string[] => {
  const args = [
    '--model',
    modelPath,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--language',
    'auto',
    '--threads',
    String(threads)
  ]

  if (!gpuEnabled) {
    args.push('--no-gpu')
  }

  return args
}
