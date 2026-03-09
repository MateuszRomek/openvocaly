import { execFile } from 'node:child_process'
import { accessSync, chmodSync, constants as fsConstants, existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { SELF_PROCESS_NAME_ALIASES } from './constants'

const execFileAsync = promisify(execFile)

type FrontProcessInput = {
  frontProcessName?: string
  frontProcessPid?: number
}

type NativeBinaryCandidatesInput = {
  resourcesPath?: string
  appPath: string
  cwd: string
  binaryName: string
}

export type ParsedEditableProbeOutput = {
  isEditable: boolean
  frontProcessName?: string
  frontProcessPid?: number
  focusedRole?: string
  focusedSubrole?: string
}

export const runAppleScript = async (lines: readonly string[]): Promise<string> => {
  const args = lines.flatMap((line) => ['-e', line])
  const { stdout } = await execFileAsync('osascript', args)
  return stdout.trim()
}

export const normalizeAppleScriptText = (value: string): string | undefined => {
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === 'missing value') {
    return undefined
  }

  return trimmed
}

export const resolveSelfProcessNames = (appName: string): Set<string> => {
  const names = new Set<string>(SELF_PROCESS_NAME_ALIASES.map((name) => name.toLowerCase()))
  const normalizedAppName = appName.trim().toLowerCase()
  if (normalizedAppName) {
    names.add(normalizedAppName)
  }

  return names
}

// Matches a probe result against the current process identity by pid first, then app-name aliases.
export const isSelfFrontProcess = (
  params: FrontProcessInput,
  selfProcessNames: ReadonlySet<string>
): boolean => {
  if (typeof params.frontProcessPid === 'number' && params.frontProcessPid === process.pid) {
    return true
  }

  if (!params.frontProcessName) {
    return false
  }

  return selfProcessNames.has(params.frontProcessName.toLowerCase())
}

export const parseEditableProbeOutput = (output: string): ParsedEditableProbeOutput => {
  const [editableRaw, processName = '', processPidRaw = '', role = '', subrole = ''] = output.split(
    '\t',
    5
  )
  const parsedProcessPid = Number.parseInt(processPidRaw, 10)

  return {
    isEditable: editableRaw === '1',
    frontProcessName: normalizeAppleScriptText(processName),
    frontProcessPid: Number.isFinite(parsedProcessPid) ? parsedProcessPid : undefined,
    focusedRole: normalizeAppleScriptText(role),
    focusedSubrole: normalizeAppleScriptText(subrole)
  }
}

// Candidate order is intentional: packaged app paths first, then dev/workspace fallback.
export const buildNativePasteBinaryCandidates = (params: NativeBinaryCandidatesInput): string[] => {
  const { resourcesPath, appPath, cwd, binaryName } = params
  const candidates = [
    resourcesPath ? join(resourcesPath, 'bin', binaryName) : null,
    resourcesPath ? join(resourcesPath, 'resources', 'bin', binaryName) : null,
    resourcesPath ? join(resourcesPath, 'app.asar.unpacked', 'resources', 'bin', binaryName) : null,
    join(appPath, 'resources', 'bin', binaryName),
    join(cwd, 'resources', 'bin', binaryName)
  ]

  const unique = new Set<string>()
  for (const candidate of candidates) {
    if (candidate) {
      unique.add(candidate)
    }
  }

  return Array.from(unique)
}

const hasExecutePermission = (path: string): boolean => {
  try {
    accessSync(path, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

const ensureExecutable = (path: string): boolean => {
  if (hasExecutePermission(path)) {
    return true
  }

  try {
    chmodSync(path, 0o755)
  } catch {
    return false
  }

  return hasExecutePermission(path)
}

// Returns the first existing candidate that is executable (or can be chmod'ed executable).
export const resolveFirstExecutableCandidate = (candidates: readonly string[]): string | null => {
  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue
    }

    if (ensureExecutable(candidate)) {
      return candidate
    }
  }

  return null
}

// Builds a concise error payload from native helper exit code + stderr output.
export const toNativePasteExitMessage = (code: number | null, stderrOutput: string): string => {
  const details = stderrOutput.trim()
  if (details.length > 0) {
    return `Native macOS paste binary exited with code ${code ?? 'unknown'}: ${details}`
  }

  return `Native macOS paste binary exited with code ${code ?? 'unknown'}.`
}
