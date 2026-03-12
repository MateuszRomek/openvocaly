import type { DictationFailureReason } from '../../shared/dictation'
import type { DictationPasteService } from '../paste/service'
import type { StorageRepository } from '../repositories/storage-repository'
import { createLogger } from '../helpers/logger'
import type { DictationIdleResetController } from './idle-reset-controller'
import type { DictationOverlayPublisher } from './overlay-publisher'
import type { DictationSessionStateManager } from './session'
import { resolvePasteLastErrorDisplayDelayMs } from './terminal-policy'

/**
 * Owns paste-last flow state machine: transcript lookup/cache, silent success path,
 * and short-lived error UX for failures.
 */
export class PasteLastTranscriptionCoordinator {
  private readonly logger = createLogger('pipeline.paste-last')
  private latestNonEmptyTranscriptTextCache: string | null = null
  private latestTranscriptCacheLoaded = false

  constructor(
    private readonly dependencies: {
      pasteService: DictationPasteService
      session: DictationSessionStateManager
      idleReset: DictationIdleResetController
      overlayPublisher: DictationOverlayPublisher
      storageRepository: StorageRepository
    }
  ) {}

  primeLatestTranscriptCache(): void {
    void this.resolveLatestTranscriptForPasteLast().catch((error) => {
      this.logger.debug({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to prime latest transcript cache for paste-last.',
        event: 'paste_last_cache_prime_failed'
      })
    })
  }

  rememberTranscript(transcriptText: string): void {
    const normalizedTranscriptText = transcriptText.trim()
    if (normalizedTranscriptText.length === 0) {
      return
    }

    this.latestNonEmptyTranscriptTextCache = normalizedTranscriptText
    this.latestTranscriptCacheLoaded = true
  }

  async trigger(): Promise<void> {
    const startedAt = Date.now()

    if (!this.dependencies.session.isIdle()) {
      this.logger.debug({
        reason: 'dictation_not_idle',
        phase: this.dependencies.session.phase,
        event: 'paste_last_ignored'
      })
      return
    }

    const sessionId = `paste-last:${Date.now()}`
    const isProgressVisible = this.showPasteLastInProgress(sessionId)
    if (!isProgressVisible) {
      this.logger.debug({
        sessionId,
        reason: 'failed_to_show_progress',
        event: 'paste_last_cancelled'
      })
      return
    }

    const latestTranscriptText = await this.resolveLatestTranscriptForPasteLast()

    if (!latestTranscriptText) {
      await this.showPasteLastError(
        'paste_runtime_error',
        'No saved transcription available to paste.',
        sessionId
      )
      this.logger.debug({
        sessionId,
        elapsedMs: Date.now() - startedAt,
        outcome: 'no_saved_transcription',
        event: 'paste_last_complete'
      })
      return
    }

    const pasteOutcome = await this.dependencies.pasteService.pasteLatestTranscript({
      sessionId,
      transcriptText: latestTranscriptText
    })

    if (pasteOutcome.type === 'auto_paste_success') {
      await this.hidePasteLastInProgress(sessionId)
      this.logger.debug({
        sessionId,
        elapsedMs: Date.now() - startedAt,
        outcome: pasteOutcome.type,
        event: 'paste_last_complete'
      })
      return
    }

    if (pasteOutcome.type === 'permission_denied') {
      await this.showPasteLastError('paste_permission_denied', pasteOutcome.message, sessionId)
      this.logger.debug({
        sessionId,
        elapsedMs: Date.now() - startedAt,
        outcome: pasteOutcome.type,
        event: 'paste_last_complete'
      })
      return
    }

    if (pasteOutcome.type === 'not_supported') {
      await this.showPasteLastError('paste_not_supported', pasteOutcome.message, sessionId)
      this.logger.debug({
        sessionId,
        elapsedMs: Date.now() - startedAt,
        outcome: pasteOutcome.type,
        event: 'paste_last_complete'
      })
      return
    }

    if (pasteOutcome.type === 'error') {
      await this.showPasteLastError('paste_runtime_error', pasteOutcome.message, sessionId)
      this.logger.debug({
        sessionId,
        elapsedMs: Date.now() - startedAt,
        outcome: pasteOutcome.type,
        event: 'paste_last_complete'
      })
      return
    }

    await this.showPasteLastError(
      'paste_runtime_error',
      'Paste failed unexpectedly. Please try again.',
      sessionId
    )
    this.logger.warn({
      sessionId,
      elapsedMs: Date.now() - startedAt,
      outcome: pasteOutcome.type,
      event: 'paste_last_unexpected_outcome'
    })
  }

  private showPasteLastInProgress(sessionId: string): boolean {
    if (!this.dependencies.session.isIdle()) {
      return false
    }

    if (!this.dependencies.session.setTranscribing(sessionId, null)) {
      return false
    }

    this.dependencies.idleReset.clear()
    void this.publishOverlayImmediate().catch((error) => {
      console.error('[pipeline] failed to show paste-last progress overlay', error)
    })
    return true
  }

  private async hidePasteLastInProgress(sessionId: string): Promise<void> {
    if (!this.dependencies.session.isCurrentSession(sessionId)) {
      return
    }

    this.dependencies.idleReset.clear()
    this.dependencies.session.resetToIdle()
    await this.dependencies.overlayPublisher.publishImmediate(null)
  }

  private async showPasteLastError(
    reason: DictationFailureReason,
    message: string,
    sessionId: string | null
  ): Promise<void> {
    const canDisplay =
      this.dependencies.session.isIdle() ||
      (sessionId ? this.dependencies.session.isCurrentSession(sessionId) : false)

    if (!canDisplay) {
      return
    }

    this.dependencies.idleReset.clear()
    this.dependencies.session.setFailed(reason, message, sessionId, null)
    await this.publishOverlayImmediate()
    this.schedulePasteLastErrorReset(sessionId)
  }

  private schedulePasteLastErrorReset(sessionId: string | null): void {
    const delayMs = resolvePasteLastErrorDisplayDelayMs()
    this.dependencies.idleReset.schedule(delayMs, () => {
      if (!this.dependencies.session.isPhase('failed')) {
        return
      }

      if (sessionId && !this.dependencies.session.isCurrentSession(sessionId)) {
        return
      }

      if (!sessionId && this.dependencies.session.sessionId) {
        return
      }

      this.dependencies.session.resetToIdle()
      void this.dependencies.overlayPublisher.publishImmediate(null).catch((error) => {
        console.error('[pipeline] failed to hide paste-last error overlay', error)
      })
    })
  }

  private async publishOverlayImmediate(): Promise<void> {
    await this.dependencies.overlayPublisher.publishImmediate(
      this.dependencies.session.toOverlayState()
    )
  }

  private async resolveLatestTranscriptForPasteLast(): Promise<string | null> {
    if (this.latestNonEmptyTranscriptTextCache) {
      return this.latestNonEmptyTranscriptTextCache
    }

    if (this.latestTranscriptCacheLoaded) {
      return null
    }

    const transcriptText =
      await this.dependencies.storageRepository.getLatestNonEmptyTranscriptText()
    this.latestTranscriptCacheLoaded = true
    this.latestNonEmptyTranscriptTextCache = transcriptText
    return transcriptText
  }
}
