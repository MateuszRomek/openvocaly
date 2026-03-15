import { spawn } from 'node:child_process'
import { existsSync, accessSync, constants as fsConstants } from 'node:fs'
import { mkdtemp, readFile, readdir, rm, stat, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpegStatic from 'ffmpeg-static'

const FLOAT32_BYTES_PER_SAMPLE = 4
const INT16_MAX = 32768
const PCM16_BYTES_PER_SAMPLE = 2

let cachedFfmpegPath: string | null = null
const MACOS_FFMPEG_CANDIDATES = [
  '/opt/homebrew/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/usr/bin/ffmpeg'
]
const LINUX_FFMPEG_CANDIDATES = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg']
const WINDOWS_FFMPEG_CANDIDATES = ['C:\\ffmpeg\\bin\\ffmpeg.exe']

const getSystemFfmpegCandidates = (): string[] => {
  if (process.platform === 'darwin') {
    return MACOS_FFMPEG_CANDIDATES
  }

  if (process.platform === 'win32') {
    return WINDOWS_FFMPEG_CANDIDATES
  }

  return LINUX_FFMPEG_CANDIDATES
}

const canExecute = (filePath: string): boolean => {
  try {
    accessSync(filePath, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

const isUsableFfmpegBinary = (filePath: string): boolean => {
  if (!existsSync(filePath)) {
    return false
  }

  if (process.platform === 'win32') {
    return true
  }

  return canExecute(filePath)
}

const normalizeWindowsExecutablePath = (filePath: string): string => {
  if (process.platform === 'win32' && !filePath.toLowerCase().endsWith('.exe')) {
    return `${filePath}.exe`
  }

  return filePath
}

const getBundledFfmpegCandidates = (): string[] => {
  try {
    const ffmpegStaticPath = ffmpegStatic as string | null
    if (!ffmpegStaticPath) {
      return []
    }

    const normalized = normalizeWindowsExecutablePath(ffmpegStaticPath)
    const unpacked = normalized.includes('app.asar')
      ? normalized.replace(/app\.asar([/\\])/, 'app.asar.unpacked$1')
      : null

    return Array.from(new Set([unpacked, normalized].filter((value): value is string => !!value)))
  } catch {
    return []
  }
}

export const getFfmpegPath = (): string | null => {
  if (cachedFfmpegPath) {
    return cachedFfmpegPath
  }

  for (const candidate of getBundledFfmpegCandidates()) {
    if (isUsableFfmpegBinary(candidate)) {
      cachedFfmpegPath = candidate
      return cachedFfmpegPath
    }
  }

  for (const candidate of getSystemFfmpegCandidates()) {
    if (!isUsableFfmpegBinary(candidate)) {
      continue
    }

    cachedFfmpegPath = candidate
    return cachedFfmpegPath
  }

  return null
}

/**
 * Converts any FFmpeg-readable media file (for example WebM/Opus from MediaRecorder)
 * into PCM 16-bit WAV with the requested sample rate/channel count.
 */
export const convertFileToWav = async (
  inputPath: string,
  outputPath: string,
  options: { sampleRate?: number; channels?: number } = {}
): Promise<void> => {
  const ffmpegPath = getFfmpegPath()
  if (!ffmpegPath) {
    throw new Error('FFmpeg not found.')
  }

  const sampleRate = options.sampleRate ?? 16000
  const channels = options.channels ?? 1

  await new Promise<void>((resolve, reject) => {
    const ffmpegArgs = [
      '-i',
      inputPath,
      '-ar',
      String(sampleRate),
      '-ac',
      String(channels),
      '-c:a',
      'pcm_s16le',
      '-y',
      outputPath
    ]

    const processRef = spawn(ffmpegPath, ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })

    let stderr = ''
    processRef.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    processRef.on('error', (error) => {
      reject(new Error(`FFmpeg process error: ${error.message}`))
    })

    processRef.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`FFmpeg conversion failed with code ${code}: ${stderr.slice(-300)}`))
    })
  })
}

export const estimatePcm16WavDurationMs = async (
  wavPath: string,
  options: { sampleRate?: number; channels?: number } = {}
): Promise<number> => {
  const sampleRate = Math.max(1, options.sampleRate ?? 16000)
  const channels = Math.max(1, options.channels ?? 1)
  const bytesPerSecond = sampleRate * channels * PCM16_BYTES_PER_SAMPLE
  const info = await stat(wavPath)
  const payloadBytes = Math.max(0, info.size - 44)

  return Math.floor((payloadBytes / bytesPerSecond) * 1000)
}

export const splitWavFileIntoChunks = async (
  inputPath: string,
  options: { chunkDurationSeconds: number; chunkFilePrefix: string }
): Promise<{ chunkPaths: string[]; chunksDir: string }> => {
  const ffmpegPath = getFfmpegPath()
  if (!ffmpegPath) {
    throw new Error('FFmpeg not found.')
  }

  if (!Number.isFinite(options.chunkDurationSeconds) || options.chunkDurationSeconds <= 0) {
    throw new Error('Chunk duration must be greater than zero.')
  }

  const chunksDir = await mkdtemp(join(tmpdir(), `${options.chunkFilePrefix}-`))
  const outputPattern = join(chunksDir, 'chunk-%03d.wav')

  try {
    await new Promise<void>((resolve, reject) => {
      const ffmpegArgs = [
        '-i',
        inputPath,
        '-f',
        'segment',
        '-segment_time',
        String(options.chunkDurationSeconds),
        '-reset_timestamps',
        '1',
        '-map',
        '0:a:0',
        '-c:a',
        'copy',
        '-y',
        outputPattern
      ]

      const processRef = spawn(ffmpegPath, ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      })

      let stderr = ''
      processRef.stderr.on('data', (chunk) => {
        stderr += String(chunk)
      })

      processRef.on('error', (error) => {
        reject(new Error(`FFmpeg process error: ${error.message}`))
      })

      processRef.on('close', (code) => {
        if (code === 0) {
          resolve()
          return
        }

        reject(new Error(`FFmpeg chunk split failed with code ${code}: ${stderr.slice(-300)}`))
      })
    })

    const entries = await readdir(chunksDir)
    const chunkPaths = entries
      .filter((entry) => entry.toLowerCase().endsWith('.wav'))
      .sort((left, right) => left.localeCompare(right))
      .map((entry) => join(chunksDir, entry))

    if (!chunkPaths.length) {
      throw new Error('FFmpeg did not produce any WAV chunks.')
    }

    return {
      chunkPaths,
      chunksDir
    }
  } catch (error) {
    await rm(chunksDir, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}

const parseWavDataChunk = (wavBuffer: Buffer): { dataOffset: number; dataSize: number } => {
  if (wavBuffer.length < 44) {
    throw new Error('Invalid WAV buffer.')
  }

  let offset = 12
  while (offset + 8 <= wavBuffer.length) {
    const chunkId = wavBuffer.toString('ascii', offset, offset + 4)
    const chunkSize = wavBuffer.readUInt32LE(offset + 4)
    if (chunkId === 'data') {
      const dataOffset = offset + 8
      const availableBytes = Math.max(0, wavBuffer.length - dataOffset)
      return { dataOffset, dataSize: Math.min(chunkSize, availableBytes) }
    }

    // WAV chunks are word-aligned; odd-sized chunks include one padding byte.
    offset += 8 + chunkSize + (chunkSize % 2)
  }

  throw new Error('WAV data chunk not found.')
}

/**
 * Reads a PCM16 WAV file and converts samples into the Float32LE byte format
 * expected by the local Parakeet websocket runtime.
 */
export const wavFileToFloat32Buffer = async (wavPath: string): Promise<Buffer> => {
  const wavBuffer = await readFile(wavPath)
  const { dataOffset, dataSize } = parseWavDataChunk(wavBuffer)
  const samplesCount = Math.floor(dataSize / 2)
  if (samplesCount <= 0) {
    return Buffer.alloc(0)
  }
  const output = Buffer.allocUnsafe(samplesCount * FLOAT32_BYTES_PER_SAMPLE)

  for (let index = 0; index < samplesCount; index += 1) {
    const int16Value = wavBuffer.readInt16LE(dataOffset + index * 2)
    const normalized = int16Value / INT16_MAX
    output.writeFloatLE(normalized, index * FLOAT32_BYTES_PER_SAMPLE)
  }

  return output
}

/**
 * Best-effort cleanup used for temporary conversion artifacts.
 */
export const safeCleanupFiles = async (filePaths: string[]): Promise<void> => {
  await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        await unlink(filePath)
      } catch {
        // Ignore cleanup failures.
      }
    })
  )
}

export const safeCleanupPaths = async (paths: string[]): Promise<void> => {
  await Promise.all(
    paths.map(async (targetPath) => {
      try {
        await rm(targetPath, { recursive: true, force: true })
      } catch {
        // Ignore cleanup failures.
      }
    })
  )
}
