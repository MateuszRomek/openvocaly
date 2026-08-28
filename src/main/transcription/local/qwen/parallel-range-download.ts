import { open } from 'node:fs/promises'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const DEFAULT_RANGE_SIZE_BYTES = 16 * 1024 * 1024
const DEFAULT_MAX_CONCURRENT_REQUESTS = 8
const PROGRESS_REPORT_INTERVAL_MS = 100

type ByteRange = {
  start: number
  end: number
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

const defaultFetch: FetchLike = (input, init): Promise<Response> => fetch(input, init)

export type ParallelRangeDownloadOptions = {
  signal: AbortSignal
  totalBytes: number
  rangeSizeBytes?: number
  maxConcurrentRequests?: number
  onProgress?: (downloadedBytes: number, totalBytes: number) => void
  fetchImpl?: FetchLike
}

/**
 * Signals that the origin did not honour byte-range requests. Callers can
 * safely fall back to a normal, single-stream download in that case.
 */
export class RangeRequestsUnsupportedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RangeRequestsUnsupportedError'
  }
}

export const createByteRanges = (totalBytes: number, rangeSizeBytes: number): ByteRange[] => {
  if (!Number.isSafeInteger(totalBytes) || totalBytes <= 0) {
    throw new Error('Parallel model download requires a positive total size.')
  }
  if (!Number.isSafeInteger(rangeSizeBytes) || rangeSizeBytes <= 0) {
    throw new Error('Parallel model download requires a positive range size.')
  }

  const ranges: ByteRange[] = []
  for (let start = 0; start < totalBytes; start += rangeSizeBytes) {
    ranges.push({ start, end: Math.min(start + rangeSizeBytes - 1, totalBytes - 1) })
  }
  return ranges
}

const readResponseRange = async (
  response: Response,
  range: ByteRange,
  totalBytes: number,
  target: Awaited<ReturnType<typeof open>>,
  onBytesWritten: (bytes: number) => void
): Promise<void> => {
  const expectedRange = `bytes ${range.start}-${range.end}/${totalBytes}`
  if (response.status !== 206 || response.headers.get('content-range') !== expectedRange) {
    throw new RangeRequestsUnsupportedError(
      'The model host did not honour byte-range requests for this download.'
    )
  }
  if (!response.body) {
    throw new Error('Model download failed: empty response body.')
  }

  const reader = response.body.getReader()
  let rangeBytesWritten = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      if (!value) {
        continue
      }

      let chunkOffset = 0
      while (chunkOffset < value.byteLength) {
        const { bytesWritten } = await target.write(
          value,
          chunkOffset,
          value.byteLength - chunkOffset,
          range.start + rangeBytesWritten + chunkOffset
        )
        if (bytesWritten === 0) {
          throw new Error('Model download failed while writing a byte range.')
        }
        chunkOffset += bytesWritten
      }
      rangeBytesWritten += value.byteLength
      onBytesWritten(value.byteLength)
    }
  } finally {
    reader.releaseLock()
  }

  if (rangeBytesWritten !== range.end - range.start + 1) {
    throw new Error('Model download returned an incomplete byte range.')
  }
}

/**
 * Downloads a known-size model file through a small, bounded pool of HTTP
 * ranges. It avoids a single slow CDN connection without overwhelming the
 * device, and writes each range directly to its final byte offset.
 */
export const downloadFileInParallelRanges = async (
  sourceUrl: string,
  destinationPath: string,
  options: ParallelRangeDownloadOptions
): Promise<void> => {
  const ranges = createByteRanges(
    options.totalBytes,
    options.rangeSizeBytes ?? DEFAULT_RANGE_SIZE_BYTES
  )
  const maxConcurrentRequests = options.maxConcurrentRequests ?? DEFAULT_MAX_CONCURRENT_REQUESTS
  if (!Number.isSafeInteger(maxConcurrentRequests) || maxConcurrentRequests <= 0) {
    throw new Error('Parallel model download requires at least one connection.')
  }

  await mkdir(dirname(destinationPath), { recursive: true })
  const target = await open(destinationPath, 'w+')
  await target.truncate(options.totalBytes)

  const abortController = new AbortController()
  const abortFromCaller = (): void => abortController.abort()
  if (options.signal.aborted) {
    abortController.abort()
  } else {
    options.signal.addEventListener('abort', abortFromCaller, { once: true })
  }

  const fetchImpl = options.fetchImpl ?? defaultFetch
  const downloadedByRange = new Array<number>(ranges.length).fill(0)
  let nextRangeIndex = 0
  let firstFailure: unknown
  let lastProgressReportAt = 0

  const reportProgress = (force = false): void => {
    const now = Date.now()
    if (!force && now - lastProgressReportAt < PROGRESS_REPORT_INTERVAL_MS) {
      return
    }
    lastProgressReportAt = now
    options.onProgress?.(
      downloadedByRange.reduce((total, downloaded) => total + downloaded, 0),
      options.totalBytes
    )
  }

  const downloadRange = async (rangeIndex: number): Promise<void> => {
    const range = ranges[rangeIndex]
    const response = await fetchImpl(sourceUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: abortController.signal,
      headers: { Range: `bytes=${range.start}-${range.end}` }
    })
    await readResponseRange(response, range, options.totalBytes, target, (bytes) => {
      downloadedByRange[rangeIndex] += bytes
      reportProgress()
    })
  }

  const worker = async (): Promise<void> => {
    while (!abortController.signal.aborted) {
      const rangeIndex = nextRangeIndex++
      if (rangeIndex >= ranges.length) {
        return
      }
      try {
        await downloadRange(rangeIndex)
      } catch (error) {
        firstFailure ??= error
        abortController.abort()
        throw error
      }
    }
  }

  try {
    await Promise.all(
      Array.from({ length: Math.min(maxConcurrentRequests, ranges.length) }, () => worker())
    )
    if (firstFailure) {
      throw firstFailure
    }
    reportProgress(true)
  } catch {
    throw firstFailure ?? new Error('Parallel model download was cancelled.')
  } finally {
    options.signal.removeEventListener('abort', abortFromCaller)
    await target.close()
  }
}
