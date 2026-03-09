import type {
  AutoPasteProbeDecision,
  ManualPasteWatcherStartResult,
  ManualPasteProbeDecision,
  PasteActionResult,
  PastePlatformAdapter,
  PastePlatformCapabilities,
  PasteProbeResult
} from '../platform-adapter'
import type { DesktopPlatform } from '../../helpers/platform'

export class NoopPastePlatformAdapter implements PastePlatformAdapter {
  constructor(private readonly platform: DesktopPlatform) {}

  capabilities(): PastePlatformCapabilities {
    return {
      platform: this.platform,
      implementationState: 'not_implemented',
      supportsAutoPaste: false,
      supportsEditableProbe: false,
      supportsManualPasteWatcher: false,
      requiresAccessibilityPermission: false
    }
  }

  async probeEditableTarget(): Promise<PasteProbeResult> {
    return {
      ok: false,
      isEditable: false,
      message: `Auto-paste is not implemented for ${this.platform}.`
    }
  }

  evaluateAutoPasteProbe(): AutoPasteProbeDecision {
    return { shouldAttemptAutoPaste: true }
  }

  evaluateManualPasteProbe(): ManualPasteProbeDecision {
    return { shouldIgnoreManualPaste: false }
  }

  async simulatePasteShortcut(): Promise<PasteActionResult> {
    return {
      ok: false,
      message: `Paste shortcut simulation is not implemented for ${this.platform}.`
    }
  }

  async startManualPasteWatcher(): Promise<ManualPasteWatcherStartResult> {
    return {
      ok: false,
      message: `Manual paste watcher is not implemented for ${this.platform}.`
    }
  }

  stopManualPasteWatcher(): void {
    return
  }
}
