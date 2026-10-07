import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const clipboardStore = vi.hoisted(() => ({ text: '' }))

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/openvocaly-paste-test', getAppPath: () => '/tmp' },
  globalShortcut: { isRegistered: () => false, register: () => true, unregister: () => undefined },
  nativeImage: { createFromBuffer: () => ({}) },
  clipboard: {
    availableFormats: () => (clipboardStore.text ? ['text/plain'] : []),
    readBuffer: () => Buffer.from(clipboardStore.text),
    readBookmark: () => ({ title: '', url: '' }),
    readImage: () => ({ isEmpty: () => true }),
    readText: () => clipboardStore.text,
    readHTML: () => '',
    readRTF: () => '',
    clear: () => {
      clipboardStore.text = ''
    },
    write: (data: { text?: string }) => {
      clipboardStore.text = data.text ?? ''
    },
    writeText: (text: string) => {
      clipboardStore.text = text
    },
    writeBuffer: () => undefined,
    writeBookmark: () => undefined
  }
}))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))

import type { PastePlatformAdapter } from './platform-adapter'
import { DictationPasteService } from './service'

const createService = (): {
  service: DictationPasteService
  simulatePasteShortcut: ReturnType<typeof vi.fn>
} => {
  const simulatePasteShortcut = vi.fn(async () => ({ ok: true }))
  const adapter: PastePlatformAdapter = {
    capabilities: () => ({
      platform: 'darwin',
      implementationState: 'ready',
      supportsAutoPaste: true,
      supportsEditableProbe: true,
      supportsManualPasteWatcher: true,
      requiresAccessibilityPermission: false
    }),
    probeEditableTarget: async () => ({ ok: true, isEditable: true }),
    simulatePasteShortcut,
    startManualPasteWatcher: async () => ({ ok: true }),
    stopManualPasteWatcher: () => undefined
  }
  const service = new DictationPasteService(
    { isAccessibilityGranted: () => true } as never,
    adapter
  )
  return { service, simulatePasteShortcut }
}

const paste = (
  service: DictationPasteService,
  transcriptText: string
): ReturnType<DictationPasteService['processTranscript']> =>
  service.processTranscript({
    sessionId: `session-${transcriptText}`,
    transcriptText,
    onManualPasteState: () => undefined
  })

describe('DictationPasteService clipboard handling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clipboardStore.text = 'user clipboard'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns right after posting paste and restores the user clipboard afterwards', async () => {
    const { service, simulatePasteShortcut } = createService()

    await expect(paste(service, 'first')).resolves.toMatchObject({ type: 'auto_paste_success' })
    expect(simulatePasteShortcut).toHaveBeenCalledTimes(1)
    expect(clipboardStore.text).toBe('first')

    await vi.advanceTimersByTimeAsync(500)
    expect(clipboardStore.text).toBe('user clipboard')
  })

  it('does not overwrite something the user copied before the restore ran', async () => {
    const { service } = createService()

    await paste(service, 'first')
    clipboardStore.text = 'copied meanwhile'
    await vi.advanceTimersByTimeAsync(500)

    expect(clipboardStore.text).toBe('copied meanwhile')
  })

  it('never lets an older restore clobber a newer paste', async () => {
    const { service } = createService()

    await paste(service, 'first')
    await paste(service, 'second')
    expect(clipboardStore.text).toBe('second')

    await vi.advanceTimersByTimeAsync(500)
    expect(clipboardStore.text).toBe('user clipboard')
  })
})
