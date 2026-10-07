import { existsSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'

const roots = await vi.hoisted(async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const base = mkdtempSync(join(tmpdir(), 'stale-sweep-test-'))
  return { base, userData: join(base, 'userData'), tmp: join(base, 'tmp') }
})

vi.mock('electron', () => ({ app: { getPath: () => roots.userData } }))
vi.mock('node:os', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:os')>()),
  tmpdir: () => roots.tmp
}))

import { sweepStaleLocalModelArtifacts } from './stale-artifact-sweep'

const TWO_HOURS_AGO = new Date(Date.now() - 2 * 60 * 60 * 1000)

const createEntry = (path: string, options: { directory?: boolean; stale: boolean }): string => {
  if (options.directory) {
    mkdirSync(path, { recursive: true })
  } else {
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, 'x')
  }
  if (options.stale) {
    utimesSync(path, TWO_HOURS_AGO, TWO_HOURS_AGO)
  }
  return path
}

describe('sweepStaleLocalModelArtifacts', () => {
  afterAll(async () => {
    const { rm } = await import('node:fs/promises')
    await rm(roots.base, { recursive: true, force: true })
  })

  it('removes only stale temp artefacts and keeps installed models and fresh downloads', async () => {
    const models = join(roots.userData, 'local-models')
    const staleWhisper = createEntry(join(models, 'whisper', 'large-v3-turbo-q5_0-1.download'), {
      stale: true
    })
    const freshWhisper = createEntry(join(models, 'whisper', 'large-v3-turbo-q5_0-2.download'), {
      stale: false
    })
    const installedWhisper = createEntry(join(models, 'whisper', 'ggml-large-v3-turbo-q5_0.bin'), {
      stale: true
    })
    const staleQwen = createEntry(join(models, 'qwen', '.qwen3-asr-0.6b-mlx-bf16-1-ab.download'), {
      directory: true,
      stale: true
    })
    const installedQwen = createEntry(join(models, 'qwen', 'qwen3-asr-0.6b-mlx-bf16'), {
      directory: true,
      stale: true
    })
    const staleParakeet = createEntry(
      join(models, 'parakeet', '.parakeet-tdt-0.6b-v3-coreml-1.download'),
      { directory: true, stale: true }
    )
    const staleTmpWav = createEntry(join(roots.tmp, 'openvocaly-whisper-abc.wav'), { stale: true })
    const staleTmpDir = createEntry(join(roots.tmp, 'openvocaly-qwen-abc'), {
      directory: true,
      stale: true
    })
    const freshTmpDir = createEntry(join(roots.tmp, 'openvocaly-parakeet-abc'), {
      directory: true,
      stale: false
    })
    const unrelatedTmp = createEntry(join(roots.tmp, 'someone-else-abc'), { stale: true })

    await sweepStaleLocalModelArtifacts()

    expect(
      [staleWhisper, staleQwen, staleParakeet, staleTmpWav, staleTmpDir].filter(existsSync)
    ).toEqual([])
    expect(
      [freshWhisper, installedWhisper, installedQwen, freshTmpDir, unrelatedTmp].every(existsSync)
    ).toBe(true)
  })

  it('tolerates missing model directories', async () => {
    const emptyBase = mkdtempSync(join(roots.base, 'empty-'))
    roots.userData = join(emptyBase, 'missing')
    await expect(sweepStaleLocalModelArtifacts()).resolves.toBeUndefined()
  })
})
