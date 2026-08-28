import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
  app: { getPath: () => '/tmp/openvocaly-test' },
  ipcMain: { handle: () => undefined }
}))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))

import type { LocalModelInfo } from '../../../shared/local-transcription'
import type { TranscriptionPreferences } from '../../../shared/transcription'
import { TranscriptionService } from './index'
import type { TranscriptionPreferencesManager } from './preferences-manager'

const PARAKET_MODEL_ID = 'parakeet-tdt-0.6b-v3-coreml'
const QWEN_MODEL_ID = 'qwen3-asr-0.6b-mlx-bf16'

type TranscriptionServiceHarness = {
  service: TranscriptionService
  getPreferences: () => TranscriptionPreferences
  getQwenDeleteCalls: () => number
  getQwenWarmCalls: () => number
}

const toModel = (id: string, downloaded: boolean): LocalModelInfo => ({
  id,
  label: id,
  description: id,
  language: 'multilingual',
  sizeMb: 1,
  downloaded,
  downloadState: downloaded ? 'complete' : 'idle'
})

const createHarness = (options?: {
  parakeetDownloaded?: boolean
  qwenDownloaded?: boolean
  qwenDownload?: () => Promise<void>
  qwenWarm?: () => Promise<void>
}): TranscriptionServiceHarness => {
  let preferences: TranscriptionPreferences = {
    providerId: 'local-qwen',
    modelId: QWEN_MODEL_ID
  }
  let qwenDeleteCalls = 0
  let qwenWarmCalls = 0

  const preferencesManager = {
    initialize: async (): Promise<void> => undefined,
    get: (): TranscriptionPreferences => preferences,
    update: async (next: Partial<TranscriptionPreferences>): Promise<TranscriptionPreferences> => {
      preferences = { ...preferences, ...next }
      return preferences
    }
  } as unknown as TranscriptionPreferencesManager

  const unavailableRuntime = {
    listModels: async () => ({ models: [] }),
    downloadModel: async () => ({ ok: true }),
    cancelDownload: () => ({ ok: false }),
    deleteModel: async () => ({ ok: true }),
    getRuntimeStatus: () => ({
      status: {
        available: true,
        running: false,
        modelId: null,
        binaryPath: null,
        platformSupported: true
      }
    }),
    startRuntime: async () => ({ ok: true }),
    stopRuntime: async () => ({ ok: true })
  }

  const service = new TranscriptionService({
    preferencesManager,
    localRuntimes: {
      'local-parakeet': {
        ...unavailableRuntime,
        listModels: async () => ({
          models: [toModel(PARAKET_MODEL_ID, options?.parakeetDownloaded ?? false)]
        })
      },
      'local-whisper': unavailableRuntime,
      'local-qwen': {
        ...unavailableRuntime,
        listModels: async () => ({
          models: [toModel(QWEN_MODEL_ID, options?.qwenDownloaded ?? true)]
        }),
        downloadModel: async () => {
          await options?.qwenDownload?.()
          return { ok: true }
        },
        deleteModel: async () => {
          qwenDeleteCalls += 1
          return { ok: true }
        },
        startRuntime: async () => {
          qwenWarmCalls += 1
          await options?.qwenWarm?.()
          return { ok: true }
        }
      }
    }
  })

  return {
    service,
    getPreferences: (): TranscriptionPreferences => preferences,
    getQwenDeleteCalls: (): number => qwenDeleteCalls,
    getQwenWarmCalls: (): number => qwenWarmCalls
  }
}

describe('TranscriptionService local model lifecycle', () => {
  it('does not delete the active model when no downloaded replacement exists', async () => {
    const harness = createHarness({ parakeetDownloaded: false, qwenDownloaded: true })

    await expect(
      harness.service.deleteLocalModel({ providerId: 'local-qwen', modelId: QWEN_MODEL_ID })
    ).resolves.toEqual({
      ok: false,
      message: 'Download and select another local model before deleting the active model.'
    })
    expect(harness.getQwenDeleteCalls()).toBe(0)
  })

  it('switches to an installed replacement before deleting the active model', async () => {
    const harness = createHarness({ parakeetDownloaded: true, qwenDownloaded: true })
    await harness.service.initialize()

    await expect(
      harness.service.deleteLocalModel({ providerId: 'local-qwen', modelId: QWEN_MODEL_ID })
    ).resolves.toEqual({ ok: true })
    expect(harness.getQwenDeleteCalls()).toBe(1)
    expect(harness.getPreferences()).toMatchObject({
      providerId: 'local-parakeet',
      modelId: PARAKET_MODEL_ID
    })
  })

  it('rejects deletion while a download owns the model mutation lane', async () => {
    let releaseDownload: (() => void) | undefined
    const downloadGate = new Promise<void>((resolve) => {
      releaseDownload = resolve
    })
    const harness = createHarness({ qwenDownload: async () => await downloadGate })

    const download = harness.service.downloadLocalModel({
      providerId: 'local-qwen',
      modelId: QWEN_MODEL_ID
    })

    await expect(
      harness.service.deleteLocalModel({ providerId: 'local-qwen', modelId: QWEN_MODEL_ID })
    ).resolves.toEqual({
      ok: false,
      message:
        'A local model change is already in progress. Wait for it to finish or cancel the download first.'
    })

    releaseDownload?.()
    await expect(download).resolves.toEqual({ ok: true })
  })

  it('does not warm local models during initialization', async () => {
    const harness = createHarness({ qwenWarm: async () => undefined })

    await harness.service.initialize()
    expect(harness.getQwenWarmCalls()).toBe(0)
  })
})
