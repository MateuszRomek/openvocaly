import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createByteRanges,
  downloadFileInParallelRanges,
  RangeRequestsUnsupportedError
} from './parallel-range-download'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
  )
})

describe('parallel Qwen model download', () => {
  it('partitions a file into contiguous byte ranges', () => {
    expect(createByteRanges(17, 8)).toEqual([
      { start: 0, end: 7 },
      { start: 8, end: 15 },
      { start: 16, end: 16 }
    ])
  })

  it('writes concurrent range responses to their original offsets', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'openvocaly-qwen-download-'))
    temporaryDirectories.push(directory)
    const source = Buffer.from('abcdefghijklmnopqrstuvwxyz')
    const requestedRanges: string[] = []
    const progress: number[] = []

    await downloadFileInParallelRanges(
      'https://models.example/qwen',
      join(directory, 'model.bin'),
      {
        signal: new AbortController().signal,
        totalBytes: source.byteLength,
        rangeSizeBytes: 8,
        maxConcurrentRequests: 3,
        onProgress: (downloadedBytes) => progress.push(downloadedBytes),
        fetchImpl: async (_input, init) => {
          const range = new Headers(init?.headers).get('range')
          expect(range).toMatch(/^bytes=\d+-\d+$/)
          requestedRanges.push(range!)
          const [start, end] = range!.replace('bytes=', '').split('-').map(Number)
          return new Response(source.subarray(start, end + 1), {
            status: 206,
            headers: {
              'content-range': `bytes ${start}-${end}/${source.byteLength}`
            }
          })
        }
      }
    )

    await expect(readFile(join(directory, 'model.bin'))).resolves.toEqual(source)
    expect(requestedRanges).toHaveLength(4)
    expect(progress.at(-1)).toBe(source.byteLength)
  })

  it('rejects a host that ignores range requests so the caller can fall back', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'openvocaly-qwen-download-'))
    temporaryDirectories.push(directory)

    await expect(
      downloadFileInParallelRanges('https://models.example/qwen', join(directory, 'model.bin'), {
        signal: new AbortController().signal,
        totalBytes: 8,
        rangeSizeBytes: 8,
        fetchImpl: async () => new Response('full file', { status: 200 })
      })
    ).rejects.toBeInstanceOf(RangeRequestsUnsupportedError)
  })
})
