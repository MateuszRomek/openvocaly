import { spawn } from 'node:child_process'
import { existsSync, accessSync, constants as fsConstants } from 'node:fs'
import { readFile, rm, stat, unlink } from 'node:fs/promises'
import ffmpegStatic from 'ffmpeg-static'
import { getProcessInvocation, type ProcessPriority } from '../../helpers/process'

const PCM16_BYTES_PER_SAMPLE = 2

type Pcm16WavChunkMetadata = {
  dataOffset: number
  dataSize: number
  sampleRate: number
  channels: number
  bitsPerSample: number
  audioFormat: number
}

export type Pcm16WavData = {
  sampleRate: number
  channels: number
  sampleBytes: Buffer
}

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
  options: {
    sampleRate?: number
    channels?: number
    signal?: AbortSignal
    priority: ProcessPriority
  }
): Promise<void> => {
  const ffmpegPath = getFfmpegPath()
  if (!ffmpegPath) {
    throw new Error('FFmpeg not found.')
  }

  const sampleRate = options.sampleRate ?? 16000
  const channels = options.channels ?? 1

  await new Promise<void>((resolve, reject) => {
    const ffmpegArgs = [
      '-threads',
      '1',
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

    const invocation = getProcessInvocation(ffmpegPath, ffmpegArgs, options.priority)
    const processRef = spawn(invocation.command, invocation.args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })
    let settled = false

    const cleanupAbortListener = (): void => {
      options.signal?.removeEventListener('abort', abortListener)
    }
    const resolveOnce = (): void => {
      if (settled) {
        return
      }
      settled = true
      cleanupAbortListener()
      resolve()
    }
    const rejectOnce = (error: Error): void => {
      if (settled) {
        return
      }
      settled = true
      cleanupAbortListener()
      reject(error)
    }
    const abortListener = (): void => {
      try {
        processRef.kill('SIGTERM')
      } catch {
        // The process may have already exited.
      }
      rejectOnce(new Error('FFmpeg conversion cancelled.'))
    }

    if (options.signal?.aborted) {
      abortListener()
      return
    }
    options.signal?.addEventListener('abort', abortListener, { once: true })

    let stderr = ''
    processRef.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    processRef.on('error', (error) => {
      rejectOnce(new Error(`FFmpeg process error: ${error.message}`))
    })

    processRef.on('close', (code) => {
      if (code === 0) {
        resolveOnce()
        return
      }

      rejectOnce(new Error(`FFmpeg conversion failed with code ${code}: ${stderr.slice(-300)}`))
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

const parsePcm16WavChunkMetadata = (wavBuffer: Buffer): Pcm16WavChunkMetadata => {
  if (wavBuffer.length < 44) {
    throw new Error('Invalid WAV buffer.')
  }

  const riffHeader = wavBuffer.toString('ascii', 0, 4)
  const waveHeader = wavBuffer.toString('ascii', 8, 12)
  if (riffHeader !== 'RIFF' || waveHeader !== 'WAVE') {
    throw new Error('Invalid WAV header.')
  }

  let sampleRate: number | null = null
  let channels: number | null = null
  let bitsPerSample: number | null = null
  let audioFormat: number | null = null
  let dataOffset: number | null = null
  let dataSize = 0

  let offset = 12
  while (offset + 8 <= wavBuffer.length) {
    const chunkId = wavBuffer.toString('ascii', offset, offset + 4)
    const chunkSize = wavBuffer.readUInt32LE(offset + 4)
    const chunkDataOffset = offset + 8
    const availableChunkBytes = Math.max(0, wavBuffer.length - chunkDataOffset)
    const boundedChunkSize = Math.min(chunkSize, availableChunkBytes)

    if (chunkId === 'fmt ' && boundedChunkSize >= 16) {
      audioFormat = wavBuffer.readUInt16LE(chunkDataOffset)
      channels = wavBuffer.readUInt16LE(chunkDataOffset + 2)
      sampleRate = wavBuffer.readUInt32LE(chunkDataOffset + 4)
      bitsPerSample = wavBuffer.readUInt16LE(chunkDataOffset + 14)
    }

    if (chunkId === 'data') {
      dataOffset = chunkDataOffset
      dataSize = boundedChunkSize
    }

    // WAV chunks are word-aligned; odd-sized chunks include one padding byte.
    offset += 8 + chunkSize + (chunkSize % 2)
  }

  if (dataOffset === null) {
    throw new Error('WAV data chunk not found.')
  }

  if (sampleRate === null || channels === null || bitsPerSample === null || audioFormat === null) {
    throw new Error('WAV fmt chunk not found.')
  }

  if (audioFormat !== 1 || bitsPerSample !== 16) {
    throw new Error(
      `Unsupported WAV format. Expected PCM16 (audioFormat=1,bits=16), received audioFormat=${audioFormat}, bits=${bitsPerSample}.`
    )
  }

  return {
    dataOffset,
    dataSize,
    sampleRate,
    channels,
    bitsPerSample,
    audioFormat
  }
}

export const readPcm16WavData = async (wavPath: string): Promise<Pcm16WavData> => {
  const wavBuffer = await readFile(wavPath)
  const metadata = parsePcm16WavChunkMetadata(wavBuffer)
  const start = metadata.dataOffset
  const end = start + metadata.dataSize

  return {
    sampleRate: metadata.sampleRate,
    channels: metadata.channels,
    sampleBytes: wavBuffer.subarray(start, end)
  }
}

export const buildPcm16WavBuffer = (
  sampleBytes: Uint8Array,
  options: { sampleRate: number; channels: number }
): Buffer => {
  const sampleRate = Math.max(1, Math.floor(options.sampleRate))
  const channels = Math.max(1, Math.floor(options.channels))
  const bytesPerSample = PCM16_BYTES_PER_SAMPLE
  const blockAlign = channels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = sampleBytes.byteLength
  const header = Buffer.alloc(44)

  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8, 'ascii')
  header.write('fmt ', 12, 'ascii')
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36, 'ascii')
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, Buffer.from(sampleBytes)])
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
