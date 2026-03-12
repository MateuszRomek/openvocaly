import { createUnrefDelay } from '../helpers/timers'
import { resolveDesktopPlatform } from '../helpers/platform'
import { createLogger } from '../helpers/logger'
import { getPastePlatformAdapter } from './adapters'
import { ClipboardTransaction } from './clipboard-transaction'
import type {
  AutoPasteProbeDecision,
  PasteActionResult,
  PastePlatformAdapter,
  PasteProbeResult
} from './platform-adapter'
import type { PermissionsService } from '../permissions/service'
import type { SessionTargetApp } from '../../shared/storage'
import {
  AUTO_PASTE_MAX_ATTEMPTS,
  AUTO_PASTE_RETRY_DELAY_MS,
  CLIPBOARD_RESTORE_DELAY_AFTER_MANUAL_PASTE_MS,
  CLIPBOARD_RESTORE_DELAY_AFTER_PASTE_MS,
  CLIPBOARD_RESTORE_DELAY_AFTER_PASTE_LAST_MS,
  MANUAL_FALLBACK_TIMEOUT_MS,
  MANUAL_SHORTCUT_REPLAY_DELAY_MS,
  POST_PASTE_TARGET_PROBE_TIMEOUT_MS
} from './service/constants'
import { getManualPasteHint, getUnsupportedPlatformMessage } from './service/helpers'
import { ManualFallbackSession } from './service/manual-fallback-session'
import { toSessionTargetApp } from './service/target-app'
import type {
  DictationPasteOutcome,
  PasteLatestTranscriptInput,
  ManualFallbackOutcome,
  ManualPasteState,
  PastePreflightResult,
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
    const preflight = this.runPastePreflight(params)
    if (!preflight.ok) {
      return preflight.outcome
    }
    const { capabilities, transcriptText } = preflight

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
        const pasteResult = await this.simulateAutoPasteWithRetry({
          sessionId: params.sessionId,
          transcriptText,
          clipboardTransaction
        })
        this.logger.debug({
          sessionId: params.sessionId,
          pasteResult
        })

        if (pasteResult.ok) {
          await createUnrefDelay(CLIPBOARD_RESTORE_DELAY_AFTER_PASTE_MS)
          clipboardTransaction.restore()
          clipboardRestored = true
          this.schedulePostPasteTargetAppProbe(params)
          return {
            type: 'auto_paste_success',
            targetApp: null
          }
        }

        this.logger.debug({
          sessionId: params.sessionId,
          message: pasteResult.message ?? null,
          event: 'auto_paste_failed_switching_to_manual_fallback'
        })
      }

      const manualOutcome = await this.awaitManualFallback({
        sessionId: params.sessionId,
        onManualPasteState: params.onManualPasteState,
        hint: getManualPasteHint(capabilities.platform),
        supportsManualPasteWatcher: capabilities.supportsManualPasteWatcher
      })

      if (manualOutcome.type === 'manual_paste_success') {
        await createUnrefDelay(CLIPBOARD_RESTORE_DELAY_AFTER_MANUAL_PASTE_MS)
        this.schedulePostPasteTargetAppProbe(params)
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

  async pasteLatestTranscript(params: PasteLatestTranscriptInput): Promise<DictationPasteOutcome> {
    const preflight = this.runPastePreflight(params)
    if (!preflight.ok) {
      return preflight.outcome
    }
    const { capabilities, transcriptText } = preflight

    const clipboardTransaction = this.createClipboardTransaction()
    clipboardTransaction.capture()

    let clipboardRestored = false

    try {
      clipboardTransaction.writeText(transcriptText)
      this.logger.debug({
        sessionId: params.sessionId,
        length: transcriptText.length
      })

      let autoPasteFailureMessage: string | undefined
      let probeResult: PasteProbeResult | null = null

      if (capabilities.supportsAutoPaste) {
        if (capabilities.supportsEditableProbe) {
          probeResult = await this.adapter.probeEditableTarget()
          this.logger.debug({
            sessionId: params.sessionId,
            probeResult
          })

          if (probeResult.ok && !probeResult.isEditable) {
            this.logger.debug({
              sessionId: params.sessionId,
              reason: 'non_editable_target',
              probeResult
            })
            return {
              type: 'error',
              message: 'Focus a text input and try again.'
            }
          }

          const probeDecision = this.resolveAutoPasteProbeDecision(probeResult)
          if (!probeDecision.shouldAttemptAutoPaste) {
            this.logger.debug({
              sessionId: params.sessionId,
              reason: probeDecision.reason ?? null,
              probeResult
            })
            autoPasteFailureMessage = probeDecision.reason
            return {
              type: 'error',
              message:
                autoPasteFailureMessage ??
                `Auto-paste failed after ${AUTO_PASTE_MAX_ATTEMPTS} attempts.`
            }
          }
        }

        const pasteResult = await this.simulateAutoPasteWithRetry({
          sessionId: params.sessionId,
          transcriptText,
          clipboardTransaction
        })
        this.logger.debug({
          sessionId: params.sessionId,
          pasteResult
        })

        if (pasteResult.ok) {
          clipboardRestored = true
          this.scheduleClipboardRestore(
            clipboardTransaction,
            CLIPBOARD_RESTORE_DELAY_AFTER_PASTE_LAST_MS
          )
          return {
            type: 'auto_paste_success',
            targetApp: toSessionTargetApp(probeResult)
          }
        }

        this.logger.debug({
          sessionId: params.sessionId,
          message: pasteResult.message ?? null,
          event: 'auto_paste_failed_without_manual_fallback'
        })
        autoPasteFailureMessage = pasteResult.message
      } else {
        autoPasteFailureMessage = 'Auto-paste is unavailable on this platform adapter.'
      }

      return {
        type: 'error',
        message:
          autoPasteFailureMessage ?? `Auto-paste failed after ${AUTO_PASTE_MAX_ATTEMPTS} attempts.`
      }
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

  async prewarm(): Promise<void> {
    const capabilities = this.adapter.capabilities()
    if (capabilities.implementationState !== 'ready') {
      return
    }

    if (!capabilities.supportsAutoPaste || !capabilities.supportsEditableProbe) {
      return
    }

    try {
      await this.adapter.probeEditableTarget()
      this.logger.debug({
        event: 'prewarm_probe_complete'
      })
    } catch (error) {
      this.logger.debug({
        message: error instanceof Error ? error.message : 'Paste prewarm probe failed.',
        event: 'prewarm_probe_failed'
      })
    }
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

  private runPastePreflight(params: {
    sessionId: string
    transcriptText: string
  }): PastePreflightResult {
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
        ok: false,
        outcome: {
          type: 'permission_denied',
          message:
            'Accessibility permission is required for auto-paste. Enable it in Settings > Permissions.'
        }
      }
    }

    const transcriptText = params.transcriptText.trim()
    if (!transcriptText) {
      return {
        ok: false,
        outcome: {
          type: 'error',
          message: 'No transcription text available to paste.'
        }
      }
    }

    if (capabilities.implementationState !== 'ready') {
      console.warn('[paste] platform adapter not implemented', {
        sessionId: params.sessionId,
        platform: capabilities.platform
      })

      return {
        ok: false,
        outcome: {
          type: 'not_supported',
          message: getUnsupportedPlatformMessage(capabilities.platform)
        }
      }
    }

    return {
      ok: true,
      capabilities,
      transcriptText
    }
  }

  private async simulateAutoPasteWithRetry(params: {
    sessionId: string
    transcriptText: string
    clipboardTransaction: ClipboardTransaction
  }): Promise<PasteActionResult> {
    let lastFailureMessage: string | undefined
    for (let attempt = 1; attempt <= AUTO_PASTE_MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 1) {
        await createUnrefDelay(AUTO_PASTE_RETRY_DELAY_MS)
        params.clipboardTransaction.writeText(params.transcriptText)
      }

      try {
        const pasteResult = await this.adapter.simulatePasteShortcut()
        this.logger.debug({
          sessionId: params.sessionId,
          attempt,
          maxAttempts: AUTO_PASTE_MAX_ATTEMPTS,
          pasteResult,
          event: 'auto_paste_attempt_result'
        })
        if (pasteResult.ok) {
          return pasteResult
        }

        lastFailureMessage =
          pasteResult.message ??
          `Auto-paste attempt ${attempt}/${AUTO_PASTE_MAX_ATTEMPTS} returned non-ok result.`
      } catch (error) {
        lastFailureMessage =
          error instanceof Error
            ? error.message
            : `Auto-paste attempt ${attempt}/${AUTO_PASTE_MAX_ATTEMPTS} failed unexpectedly.`
        this.logger.warn({
          sessionId: params.sessionId,
          attempt,
          maxAttempts: AUTO_PASTE_MAX_ATTEMPTS,
          message: lastFailureMessage,
          event: 'auto_paste_attempt_error'
        })
      }
    }

    return {
      ok: false,
      message: lastFailureMessage ?? `Auto-paste failed after ${AUTO_PASTE_MAX_ATTEMPTS} attempts.`
    }
  }

  private schedulePostPasteTargetAppProbe(params: ProcessTranscriptInput): void {
    if (!params.onPostPasteTargetApp) {
      return
    }

    void this.emitPostPasteTargetApp(params.onPostPasteTargetApp)
  }

  private async emitPostPasteTargetApp(
    onPostPasteTargetApp: (targetApp: SessionTargetApp) => Promise<void> | void
  ): Promise<void> {
    const probeResult = await this.probeEditableTargetWithTimeout(
      POST_PASTE_TARGET_PROBE_TIMEOUT_MS
    )
    const targetApp = toSessionTargetApp(probeResult)
    if (!targetApp) {
      return
    }

    try {
      await onPostPasteTargetApp(targetApp)
    } catch (error) {
      this.logger.debug({
        message:
          error instanceof Error
            ? error.message
            : 'Post-paste target app callback failed unexpectedly.'
      })
    }
  }

  private async probeEditableTargetWithTimeout(
    timeoutMs: number
  ): Promise<PasteProbeResult | null> {
    return await new Promise((resolve) => {
      let settled = false
      const timeout = setTimeout(() => {
        if (settled) {
          return
        }

        settled = true
        resolve(null)
      }, timeoutMs)
      timeout.unref()

      void this.adapter
        .probeEditableTarget()
        .then((probeResult) => {
          if (settled) {
            return
          }

          settled = true
          clearTimeout(timeout)
          resolve(probeResult)
        })
        .catch(() => {
          if (settled) {
            return
          }

          settled = true
          clearTimeout(timeout)
          resolve(null)
        })
    })
  }

  private scheduleClipboardRestore(
    clipboardTransaction: ClipboardTransaction,
    delayMs: number
  ): void {
    const restoreTimer = setTimeout(() => {
      try {
        clipboardTransaction.restore()
      } catch (error) {
        this.logger.debug({
          message:
            error instanceof Error
              ? error.message
              : 'Clipboard restore failed after scheduled delay.',
          event: 'clipboard_restore_scheduled_failed'
        })
      }
    }, delayMs)
    restoreTimer.unref()
  }
}
