import { createUnrefDelay } from '../helpers/timers'
import { resolveDesktopPlatform } from '../helpers/platform'
import { createLogger } from '../helpers/logger'
import { getPastePlatformAdapter } from './adapters'
import { ClipboardTransaction } from './clipboard-transaction'
import type {
  AutoPasteProbeDecision,
  PastePlatformAdapter,
  PasteProbeResult
} from './platform-adapter'
import type { PermissionsService } from '../permissions/service'
import {
  CLIPBOARD_RESTORE_DELAY_AFTER_MANUAL_PASTE_MS,
  CLIPBOARD_RESTORE_DELAY_AFTER_PASTE_MS,
  MANUAL_FALLBACK_TIMEOUT_MS,
  MANUAL_SHORTCUT_REPLAY_DELAY_MS
} from './service/constants'
import { getManualPasteHint, getUnsupportedPlatformMessage } from './service/helpers'
import { ManualFallbackSession } from './service/manual-fallback-session'
import { toSessionTargetApp } from './service/target-app'
import type {
  DictationPasteOutcome,
  ManualFallbackOutcome,
  ManualPasteState,
  ProcessTranscriptInput
} from './service/types'

export type { DictationPasteOutcome, ManualPasteState } from './service/types'

const DEFAULT_AUTO_PASTE_PROBE_DECISION: AutoPasteProbeDecision = {
  shouldAttemptAutoPaste: true
}

/**
 * Owns transcript post-processing for paste/copy paths.
 * Platform behavior is delegated through PastePlatformAdapter.
 */
export class DictationPasteService {
  private readonly logger = createLogger('paste.service')
  private readonly adapter: PastePlatformAdapter
  private activeFallbackSession: ManualFallbackSession | null = null

  constructor(
    private readonly permissionsService: PermissionsService,
    adapter: PastePlatformAdapter = getPastePlatformAdapter(resolveDesktopPlatform()),
    private readonly createClipboardTransaction: () => ClipboardTransaction = () =>
      new ClipboardTransaction()
  ) {
    this.adapter = adapter
  }

  async processTranscript(params: ProcessTranscriptInput): Promise<DictationPasteOutcome> {
    const capabilities = this.adapter.capabilities()
    this.logger.debug({
      sessionId: params.sessionId,
      platform: capabilities.platform,
      capabilities
    })

    if (
      capabilities.requiresAccessibilityPermission &&
      !this.permissionsService.isAccessibilityGranted()
    ) {
      console.warn('[paste] permission denied for paste flow', {
        sessionId: params.sessionId
      })
      return {
        type: 'permission_denied',
        message:
          'Accessibility permission is required for auto-paste. Enable it in Settings > Permissions.'
      }
    }

    const transcriptText = params.transcriptText.trim()
    if (!transcriptText) {
      return {
        type: 'error',
        message: 'No transcription text available to paste.'
      }
    }

    if (capabilities.implementationState !== 'ready') {
      console.warn('[paste] platform adapter not implemented', {
        sessionId: params.sessionId,
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
      this.logger.debug({
        sessionId: params.sessionId,
        length: transcriptText.length
      })

      if (capabilities.supportsAutoPaste) {
        const probeResult = capabilities.supportsEditableProbe
          ? await this.adapter.probeEditableTarget()
          : null

        if (probeResult) {
          this.logger.debug({
            sessionId: params.sessionId,
            probeResult
          })
        }

        const probeDecision = this.resolveAutoPasteProbeDecision(probeResult)

        if (!probeDecision.shouldAttemptAutoPaste) {
          this.logger.debug({
            sessionId: params.sessionId,
            reason: probeDecision.reason ?? null,
            probeResult
          })
        }

        if (probeDecision.shouldAttemptAutoPaste) {
          const pasteResult = await this.adapter.simulatePasteShortcut()
          this.logger.debug({
            sessionId: params.sessionId,
            pasteResult
          })

          if (pasteResult.ok) {
            await createUnrefDelay(CLIPBOARD_RESTORE_DELAY_AFTER_PASTE_MS)
            clipboardTransaction.restore()
            clipboardRestored = true
            return {
              type: 'auto_paste_success',
              targetApp: toSessionTargetApp(probeResult)
            }
          }
        }
      }

      const manualOutcome = await this.awaitManualFallback({
        sessionId: params.sessionId,
        onManualPasteState: params.onManualPasteState,
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
      if (this.activeFallbackSession?.sessionId === params.sessionId) {
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

  private async awaitManualFallback(params: {
    sessionId: string
    onManualPasteState: (state: ManualPasteState) => Promise<void> | void
    hint: string
    supportsManualPasteWatcher: boolean
  }): Promise<ManualFallbackOutcome> {
    const session = new ManualFallbackSession({
      sessionId: params.sessionId,
      timeoutMs: MANUAL_FALLBACK_TIMEOUT_MS,
      replayDelayMs: MANUAL_SHORTCUT_REPLAY_DELAY_MS,
      hint: params.hint,
      supportsManualPasteWatcher: params.supportsManualPasteWatcher,
      adapter: this.adapter,
      onManualPasteState: params.onManualPasteState
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

  private resolveAutoPasteProbeDecision(
    probeResult: PasteProbeResult | null
  ): AutoPasteProbeDecision {
    if (!probeResult) {
      return DEFAULT_AUTO_PASTE_PROBE_DECISION
    }

    return this.adapter.evaluateAutoPasteProbe?.(probeResult) ?? DEFAULT_AUTO_PASTE_PROBE_DECISION
  }
}
