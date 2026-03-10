import type { SessionTargetApp } from '../../../shared/storage'

export type ManualPasteState = {
  remainingMs: number
  timeoutMs: number
  hint: string
}

export type ManualFallbackOutcome =
  | { type: 'manual_paste_success'; targetApp: SessionTargetApp | null }
  | { type: 'manual_timeout' }
  | { type: 'manual_cancelled' }

export type DictationPasteOutcome =
  | { type: 'auto_paste_success'; targetApp: SessionTargetApp | null }
  | ManualFallbackOutcome
  | { type: 'permission_denied'; message: string }
  | { type: 'not_supported'; message: string }
  | { type: 'error'; message: string }

export type ProcessTranscriptInput = {
  sessionId: string
  transcriptText: string
  onManualPasteState: (state: ManualPasteState) => Promise<void> | void
  onPostPasteTargetApp?: (targetApp: SessionTargetApp) => Promise<void> | void
}
