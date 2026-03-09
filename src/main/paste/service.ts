import { createUnrefDelay } from '../helpers/timers'
import { permissionsService } from '../permissions/service'
import { resolveDesktopPlatform } from '../helpers/platform'
import { getPastePlatformAdapter } from './adapters'
import { ClipboardTransaction } from './clipboard-transaction'
import type { PastePlatformAdapter } from './platform-adapter'
import {
  CLIPBOARD_RESTORE_DELAY_AFTER_MANUAL_PASTE_MS,
  CLIPBOARD_RESTORE_DELAY_AFTER_PASTE_MS,
  MANUAL_FALLBACK_TIMEOUT_MS,
  MANUAL_SHORTCUT_REPLAY_DELAY_MS
} from './service/constants'
import { getManualPasteHint, getUnsupportedPlatformMessage } from './service/helpers'
import { ManualFallbackSession } from './service/manual-fallback-session'
import type {
  DictationPasteOutcome,
  ManualFallbackOutcome,
  ManualPasteState,
  ProcessTranscriptInput
} from './service/types'

export type { DictationPasteOutcome, ManualPasteState } from './service/types'

/**
 * Owns transcript post-processing for paste/copy paths.
 * Platform behavior is delegated through PastePlatformAdapter.
 */
export class DictationPasteService {
  private readonly adapter: PastePlatformAdapter
  private activeFallbackSession: ManualFallbackSession | null = null

  constructor(
    adapter: PastePlatformAdapter = getPastePlatformAdapter(resolveDesktopPlatform()),
    private readonly createClipboardTransaction: () => ClipboardTransaction = () =>
      new ClipboardTransaction()
  ) {
    this.adapter = adapter
  }

  async processTranscript(input: ProcessTranscriptInput): Promise<DictationPasteOutcome> {
    const capabilities = this.adapter.capabilities()
    console.log('[paste] process transcript start', {
      sessionId: input.sessionId,
      platform: capabilities.platform,
      capabilities
    })

    if (
      capabilities.requiresAccessibilityPermission &&
      !permissionsService.isAccessibilityGranted()
    ) {
      console.warn('[paste] permission denied for paste flow', {
        sessionId: input.sessionId
      })
      return {
        type: 'permission_denied',
        message:
          'Accessibility permission is required for auto-paste. Enable it in Settings > Permissions.'
      }
    }

    const transcriptText = input.transcriptText.trim()
    if (!transcriptText) {
      return {
        type: 'error',
        message: 'No transcription text available to paste.'
      }
    }

    if (capabilities.implementationState !== 'ready') {
      console.warn('[paste] platform adapter not implemented', {
        sessionId: input.sessionId,
        platform: capabilities.platform
      })

      return {
        type: 'not_supported',
        message: getUnsupportedPlatformMessage(capabilities.platform)
      }
    }

    const clipboardTransaction = this.createClipboardTransaction()
    clipboardTransaction.capture()

    let clipboardRestored = false

    try {
      clipboardTransaction.writeText(transcriptText)
      console.log('[paste] transcript copied to clipboard', {
        sessionId: input.sessionId,
        length: transcriptText.length
      })

      if (capabilities.supportsAutoPaste) {
        let shouldAttemptAutoPaste = true
        let autoPasteSkipReason: string | null = null
        if (capabilities.supportsEditableProbe) {
          const probeResult = await this.adapter.probeEditableTarget()
          console.log('[paste] editable probe result', {
            sessionId: input.sessionId,
            probeResult
          })

          const probeDecision = this.adapter.evaluateAutoPasteProbe?.(probeResult) ?? {
            shouldAttemptAutoPaste: true
          }
          shouldAttemptAutoPaste = probeDecision.shouldAttemptAutoPaste
          autoPasteSkipReason = probeDecision.reason ?? null
          if (!probeDecision.shouldAttemptAutoPaste && probeDecision.reason) {
            console.log(`[paste] skipping auto paste on ${probeDecision.reason}`, {
              sessionId: input.sessionId,
              probeResult
            })
          }
        }

        if (!shouldAttemptAutoPaste) {
          console.log('[paste] auto paste skipped', {
            sessionId: input.sessionId,
            reason: autoPasteSkipReason
          })
        }

        if (shouldAttemptAutoPaste) {
          const pasteResult = await this.adapter.simulatePasteShortcut()
          console.log('[paste] auto paste result', {
            sessionId: input.sessionId,
            pasteResult
          })

          if (pasteResult.ok) {
            await createUnrefDelay(CLIPBOARD_RESTORE_DELAY_AFTER_PASTE_MS)
            clipboardTransaction.restore()
            clipboardRestored = true
            return { type: 'auto_paste_success' }
          }
        }
      }

      const manualOutcome = await this.awaitManualFallback({
        sessionId: input.sessionId,
        onManualPasteState: input.onManualPasteState,
        hint: getManualPasteHint(capabilities.platform),
        supportsManualPasteWatcher: capabilities.supportsManualPasteWatcher
      })

      if (manualOutcome.type === 'manual_paste_success') {
        await createUnrefDelay(CLIPBOARD_RESTORE_DELAY_AFTER_MANUAL_PASTE_MS)
      }

      clipboardTransaction.restore()
      clipboardRestored = true
      return manualOutcome
    } catch (error) {
      return {
        type: 'error',
        message: error instanceof Error ? error.message : 'Auto-paste flow failed unexpectedly.'
      }
    } finally {
      if (this.activeFallbackSession?.sessionId === input.sessionId) {
        this.activeFallbackSession.cancel()
        this.clearActiveFallback()
      }

      if (!clipboardRestored) {
        clipboardTransaction.restore()
      }
    }
  }

  cancelActiveFallback(sessionId?: string): boolean {
    if (!this.activeFallbackSession) {
      return false
    }

    if (sessionId && this.activeFallbackSession.sessionId !== sessionId) {
      return false
    }

    return this.activeFallbackSession.cancel()
  }

  destroy(): void {
    this.cancelActiveFallback()
    this.adapter.stopManualPasteWatcher()
    this.clearActiveFallback()
  }

  private async awaitManualFallback(input: {
    sessionId: string
    onManualPasteState: (state: ManualPasteState) => Promise<void> | void
    hint: string
    supportsManualPasteWatcher: boolean
  }): Promise<ManualFallbackOutcome> {
    const session = new ManualFallbackSession({
      sessionId: input.sessionId,
      timeoutMs: MANUAL_FALLBACK_TIMEOUT_MS,
      replayDelayMs: MANUAL_SHORTCUT_REPLAY_DELAY_MS,
      hint: input.hint,
      supportsManualPasteWatcher: input.supportsManualPasteWatcher,
      adapter: this.adapter,
      onManualPasteState: input.onManualPasteState
    })

    this.activeFallbackSession = session
    try {
      return await session.run()
    } finally {
      if (this.activeFallbackSession === session) {
        this.clearActiveFallback()
      }
    }
  }

  private clearActiveFallback(): void {
    this.activeFallbackSession = null
  }
}
