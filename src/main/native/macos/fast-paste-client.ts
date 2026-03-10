import { spawn } from 'node:child_process'
import { createSettleOnce } from '../../helpers/settle-once'

export type MacOSFastPasteCommand = 'paste' | 'probe'

export type MacOSFastPasteRunResult = {
  ok: boolean
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  message?: string
}

export class MacOSFastPasteClient {
  async runCommand(
    binaryPath: string,
    command: MacOSFastPasteCommand,
    timeoutMs: number
  ): Promise<MacOSFastPasteRunResult> {
    return await new Promise((resolve) => {
      const processRef = spawn(binaryPath, [command], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      })
      let stdoutOutput = ''
      let stderrOutput = ''
      let timeout: NodeJS.Timeout | null = null

      const settleController = createSettleOnce<MacOSFastPasteRunResult>((result) => {
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
          code: null,
          stdout: stdoutOutput,
          stderr: stderrOutput,
          timedOut: false,
          message: `Native macOS ${command} command failed to launch: ${error.message}`
        })
      })

      processRef.on('close', (code) => {
        settle({
          ok: code === 0,
          code,
          stdout: stdoutOutput,
          stderr: stderrOutput,
          timedOut: false
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
          code: null,
          stdout: stdoutOutput,
          stderr: stderrOutput,
          timedOut: true,
          message: `Native macOS ${command} command timed out after ${timeoutMs}ms.`
        })
      }, timeoutMs)
      timeout.unref()
    })
  }
}
