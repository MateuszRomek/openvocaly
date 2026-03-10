import { spawn } from 'node:child_process'
import { app, globalShortcut } from 'electron'
import { createSettleOnce } from '../../../helpers/settle-once'
import type {
  AutoPasteProbeDecision,
  ManualPasteProbeDecision,
  ManualPasteWatcherStartResult,
  PasteActionResult,
  PastePlatformAdapter,
  PastePlatformCapabilities,
  PasteProbeResult
} from '../../platform-adapter'
import {
  APPLE_SCRIPT_PASTE_LINES,
  APPLE_SCRIPT_PROBE_EDITABLE_LINES,
  MANUAL_PASTE_ACCELERATOR,
  NATIVE_PASTE_BINARY_NAME,
  NATIVE_PASTE_TIMEOUT_MS,
  NATIVE_PROBE_TIMEOUT_MS
} from './constants'
import {
  buildNativePasteBinaryCandidates,
  isSelfFrontProcess,
  parseEditableProbeOutput,
  parseNativeProbeOutput,
  resolveFirstExecutableCandidate,
  resolveSelfProcessNames,
  runAppleScript,
  toNativePasteExitMessage,
  toNativeProbeExitMessage
} from './helpers'
import { evaluateMacOSAutoPasteDecision, evaluateMacOSManualPasteDecision } from './probe-decisions'

export class MacOSPastePlatformAdapter implements PastePlatformAdapter {
  private watcherRegistered = false
  private nativePasteBinaryPath: string | null | undefined
  private readonly selfProcessNames = resolveSelfProcessNames(app.getName())

  capabilities(): PastePlatformCapabilities {
    return {
      platform: 'darwin',
      implementationState: 'ready',
      supportsAutoPaste: true,
      supportsEditableProbe: true,
      supportsManualPasteWatcher: true,
      requiresAccessibilityPermission: true
    }
  }

  async probeEditableTarget(): Promise<PasteProbeResult> {
    const nativePasteBinaryPath = this.resolveNativePasteBinaryPath()
    if (nativePasteBinaryPath) {
      const nativeProbeResult = await this.runNativeProbeBinary(nativePasteBinaryPath)
      if (nativeProbeResult.ok && nativeProbeResult.probeResult.ok) {
        return this.attachSelfProcessFlag(nativeProbeResult.probeResult)
      }

      if (!nativeProbeResult.ok) {
        console.warn('[paste] native macOS probe failed, falling back to AppleScript', {
          message: nativeProbeResult.message
        })
      } else {
        console.warn(
          '[paste] native macOS probe returned non-ok payload, falling back to AppleScript',
          {
            probeResult: nativeProbeResult.probeResult
          }
        )
      }
    }

    try {
      const output = await runAppleScript(APPLE_SCRIPT_PROBE_EDITABLE_LINES)
      const parsedProbe = parseEditableProbeOutput(output)
      return this.attachSelfProcessFlag({
        ok: true,
        ...parsedProbe
      })
    } catch (error) {
      return {
        ok: false,
        isEditable: false,
        message:
          error instanceof Error ? error.message : 'Failed to probe focused element editability.'
      }
    }
  }

  evaluateAutoPasteProbe(probeResult: PasteProbeResult): AutoPasteProbeDecision {
    return evaluateMacOSAutoPasteDecision(probeResult)
  }

  evaluateManualPasteProbe(probeResult: PasteProbeResult): ManualPasteProbeDecision {
    return evaluateMacOSManualPasteDecision(probeResult)
  }

  async simulatePasteShortcut(): Promise<PasteActionResult> {
    let nativePasteError: string | null = null
    const nativePasteBinaryPath = this.resolveNativePasteBinaryPath()
    if (nativePasteBinaryPath) {
      const nativeResult = await this.runNativePasteBinary(nativePasteBinaryPath)
      // Native helper is our preferred path; on success we skip fallback entirely.
      if (nativeResult.ok) {
        return nativeResult
      }

      nativePasteError = nativeResult.message ?? 'Native macOS paste binary failed.'
      console.warn('[paste] native macOS paste failed, falling back to AppleScript', {
        message: nativePasteError
      })
    }

    try {
      await runAppleScript(APPLE_SCRIPT_PASTE_LINES)
      return { ok: true }
    } catch (error) {
      const appleScriptMessage =
        error instanceof Error ? error.message : 'Failed to simulate paste shortcut.'

      if (!nativePasteError) {
        return {
          ok: false,
          message: appleScriptMessage
        }
      }

      return {
        ok: false,
        message: `${nativePasteError} AppleScript fallback failed: ${appleScriptMessage}`
      }
    }
  }

  async startManualPasteWatcher(
    onPasteShortcut: () => void
  ): Promise<ManualPasteWatcherStartResult> {
    this.stopManualPasteWatcher()

    if (globalShortcut.isRegistered(MANUAL_PASTE_ACCELERATOR)) {
      return {
        ok: false,
        message: `${MANUAL_PASTE_ACCELERATOR} is already registered by another action.`
      }
    }

    try {
      if (!globalShortcut.register(MANUAL_PASTE_ACCELERATOR, () => onPasteShortcut())) {
        return {
          ok: false,
          message: `Failed to register ${MANUAL_PASTE_ACCELERATOR} watcher.`
        }
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to register manual paste watcher.'
      }
    }

    this.watcherRegistered = true
    return { ok: true }
  }

  stopManualPasteWatcher(): void {
    if (!this.watcherRegistered) {
      return
    }

    globalShortcut.unregister(MANUAL_PASTE_ACCELERATOR)
    this.watcherRegistered = false
  }

  private resolveNativePasteBinaryPath(): string | null {
    if (this.nativePasteBinaryPath !== undefined) {
      return this.nativePasteBinaryPath
    }

    const candidates = buildNativePasteBinaryCandidates({
      resourcesPath: process.resourcesPath,
      appPath: app.getAppPath(),
      cwd: process.cwd(),
      binaryName: NATIVE_PASTE_BINARY_NAME
    })

    this.nativePasteBinaryPath = resolveFirstExecutableCandidate(candidates)
    return this.nativePasteBinaryPath
  }

  private async runNativePasteBinary(binaryPath: string): Promise<PasteActionResult> {
    return await new Promise((resolve) => {
      const processRef = spawn(binaryPath, ['paste'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      })
      let stderrOutput = ''
      let timeout: NodeJS.Timeout | null = null

      const settleController = createSettleOnce<PasteActionResult>((result) => {
        if (timeout) {
          clearTimeout(timeout)
        }
        resolve(result)
      })
      const settle = settleController.settle

      processRef.stderr.on('data', (chunk) => {
        stderrOutput += String(chunk)
      })

      processRef.on('error', (error) => {
        settle({
          ok: false,
          message: `Native macOS paste binary failed to launch: ${error.message}`
        })
      })

      processRef.on('close', (code) => {
        if (code === 0) {
          settle({ ok: true })
          return
        }

        settle({
          ok: false,
          message: toNativePasteExitMessage(code, stderrOutput)
        })
      })

      timeout = setTimeout(() => {
        try {
          processRef.kill('SIGKILL')
        } catch {
          // Ignore timeout kill errors.
        }

        settle({
          ok: false,
          message: `Native macOS paste binary timed out after ${NATIVE_PASTE_TIMEOUT_MS}ms.`
        })
      }, NATIVE_PASTE_TIMEOUT_MS)
      timeout.unref()
    })
  }

  private async runNativeProbeBinary(binaryPath: string): Promise<NativeProbeActionResult> {
    return await new Promise((resolve) => {
      const processRef = spawn(binaryPath, ['probe'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      })
      let stdoutOutput = ''
      let stderrOutput = ''
      let timeout: NodeJS.Timeout | null = null

      const settleController = createSettleOnce<NativeProbeActionResult>((result) => {
        if (timeout) {
          clearTimeout(timeout)
        }
        resolve(result)
      })
      const settle = settleController.settle

      processRef.stdout.on('data', (chunk) => {
        stdoutOutput += String(chunk)
      })

      processRef.stderr.on('data', (chunk) => {
        stderrOutput += String(chunk)
      })

      processRef.on('error', (error) => {
        settle({
          ok: false,
          message: `Native macOS probe command failed to launch: ${error.message}`
        })
      })

      processRef.on('close', (code) => {
        if (code !== 0) {
          settle({
            ok: false,
            message: toNativeProbeExitMessage(code, stderrOutput)
          })
          return
        }

        try {
          const parsed = parseNativeProbeOutput(stdoutOutput.trim())
          settle({
            ok: true,
            probeResult: {
              ok: parsed.ok,
              isEditable: parsed.isEditable,
              frontProcessName: parsed.frontProcessName,
              frontProcessIdentifier: parsed.frontProcessIdentifier,
              frontProcessPath: parsed.frontProcessPath,
              frontProcessPid: parsed.frontProcessPid,
              focusedRole: parsed.focusedRole,
              focusedSubrole: parsed.focusedSubrole,
              message: parsed.message
            }
          })
        } catch (error) {
          settle({
            ok: false,
            message: error instanceof Error ? error.message : 'Native probe output parse failed.'
          })
        }
      })

      timeout = setTimeout(() => {
        try {
          processRef.kill('SIGKILL')
        } catch {
          // Ignore timeout kill errors.
        }

        settle({
          ok: false,
          message: `Native macOS probe command timed out after ${NATIVE_PROBE_TIMEOUT_MS}ms.`
        })
      }, NATIVE_PROBE_TIMEOUT_MS)
      timeout.unref()
    })
  }

  private attachSelfProcessFlag(probeResult: PasteProbeResult): PasteProbeResult {
    return {
      ...probeResult,
      isSelfApp: isSelfFrontProcess(probeResult, this.selfProcessNames)
    }
  }
}

type NativeProbeActionResult =
  | { ok: true; probeResult: PasteProbeResult }
  | { ok: false; message: string }
